#!/usr/bin/env bash
#
# deploy-runpod.sh — one-shot build+push+launch for the TTB label verification
# app on RunPod GPU pods.
#
# Usage:
#   scripts/deploy-runpod.sh                       # dry-run summary
#   scripts/deploy-runpod.sh --build               # just build the local image
#   scripts/deploy-runpod.sh --build --push        # build + push to registry
#   scripts/deploy-runpod.sh --launch              # build + push + launch pod
#   scripts/deploy-runpod.sh --launch --gpu L4     # launch on a different GPU
#   scripts/deploy-runpod.sh --teardown <pod-id>   # stop and delete a pod
#
# Required env vars for --push / --launch:
#   DOCKER_REGISTRY         e.g. docker.io/yourname   (no trailing slash)
#   DOCKER_IMAGE_NAME       e.g. ttb-label-verification  (default: see below)
#   DOCKER_IMAGE_TAG        e.g. latest               (default: git sha)
#   RUNPOD_API_KEY          set via `runpodctl doctor` or exported
#
# Optional:
#   RUNPOD_GPU              default: "NVIDIA RTX A5000"  (best $/VRAM)
#   RUNPOD_CLOUD_TYPE       SECURE or COMMUNITY; default COMMUNITY (cheaper)
#   RUNPOD_VOLUME_GB        default 30 (model cache + container working dir)
#   RUNPOD_CONTAINER_GB     default 25 (image unpack headroom)
#   RUNPOD_POD_NAME         default ttb-label-verification-$(date +%Y%m%d-%H%M%S)
#
# This script NEVER launches a billable pod without an explicit --launch flag,
# so you can diff the plan in dry-run mode first.

set -euo pipefail

###############################################################################
# Paths and defaults.
###############################################################################
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DOCKERFILE="${REPO_ROOT}/docker/runpod/Dockerfile"
DEFAULT_IMAGE_NAME="ttb-label-verification"
DEFAULT_GPU="NVIDIA RTX A5000"
DEFAULT_CLOUD_TYPE="COMMUNITY"
DEFAULT_VOLUME_GB=30
DEFAULT_CONTAINER_GB=25

# Known-good GPU → VRAM map, used for sanity warnings only. Not authoritative:
# runpodctl gpu list is the truth.
#
# Implemented as a function rather than an associative array so the script
# runs on /bin/bash 3.2 (macOS default) as well as newer bashes where
# associative arrays are available.
gpu_vram_gb() {
  case "$1" in
    "NVIDIA RTX A4000")                  echo 16 ;;
    "NVIDIA RTX A4500")                  echo 20 ;;
    "NVIDIA RTX A5000")                  echo 24 ;;
    "NVIDIA RTX A6000")                  echo 48 ;;
    "NVIDIA GeForce RTX 3090")           echo 24 ;;
    "NVIDIA GeForce RTX 4090")           echo 24 ;;
    "NVIDIA GeForce RTX 5090")           echo 32 ;;
    "NVIDIA RTX 2000 Ada Generation")    echo 16 ;;
    "NVIDIA RTX 4000 Ada Generation")    echo 20 ;;
    "NVIDIA L4")                         echo 24 ;;
    "NVIDIA L40S")                       echo 48 ;;
    "NVIDIA A40")                        echo 48 ;;
    "NVIDIA A100-SXM4-80GB")             echo 80 ;;
    "NVIDIA H100 80GB HBM3")             echo 80 ;;
    *)                                   echo "" ;;
  esac
}

###############################################################################
# CLI parsing.
###############################################################################
MODE="dry-run"
GPU_OVERRIDE=""
TEARDOWN_POD_ID=""

print_usage() {
  sed -n '1,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build)
      MODE="build"; shift ;;
    --push)
      if [[ "${MODE}" == "build" ]]; then MODE="build-push"; else MODE="push"; fi
      shift ;;
    --launch)
      MODE="launch"; shift ;;
    --teardown)
      MODE="teardown"
      if [[ $# -lt 2 ]]; then
        echo "error: --teardown requires a pod id, e.g. --teardown abc123xyz" >&2
        exit 1
      fi
      TEARDOWN_POD_ID="$2"
      shift 2 ;;
    --gpu)
      if [[ $# -lt 2 ]]; then
        echo "error: --gpu requires a GPU name, e.g. --gpu \"NVIDIA RTX A5000\"" >&2
        exit 1
      fi
      GPU_OVERRIDE="$2"
      shift 2 ;;
    -h|--help)
      print_usage; exit 0 ;;
    *)
      echo "unknown flag: $1" >&2
      print_usage
      exit 1 ;;
  esac
done

###############################################################################
# Resolve variables.
###############################################################################
GIT_SHA="$(cd "${REPO_ROOT}" && git rev-parse --short HEAD 2>/dev/null || echo dev)"

DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
DOCKER_IMAGE_NAME="${DOCKER_IMAGE_NAME:-${DEFAULT_IMAGE_NAME}}"
DOCKER_IMAGE_TAG="${DOCKER_IMAGE_TAG:-${GIT_SHA}}"

RUNPOD_GPU="${GPU_OVERRIDE:-${RUNPOD_GPU:-${DEFAULT_GPU}}}"
RUNPOD_CLOUD_TYPE="${RUNPOD_CLOUD_TYPE:-${DEFAULT_CLOUD_TYPE}}"
RUNPOD_VOLUME_GB="${RUNPOD_VOLUME_GB:-${DEFAULT_VOLUME_GB}}"
RUNPOD_CONTAINER_GB="${RUNPOD_CONTAINER_GB:-${DEFAULT_CONTAINER_GB}}"
RUNPOD_POD_NAME="${RUNPOD_POD_NAME:-ttb-label-verification-$(date -u +%Y%m%d-%H%M%S)}"

local_image_ref() {
  echo "${DOCKER_IMAGE_NAME}:${DOCKER_IMAGE_TAG}"
}
remote_image_ref() {
  if [[ -z "${DOCKER_REGISTRY}" ]]; then
    echo "" ; return
  fi
  echo "${DOCKER_REGISTRY%/}/${DOCKER_IMAGE_NAME}:${DOCKER_IMAGE_TAG}"
}

###############################################################################
# Helpers.
###############################################################################
require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required command '$1' is not installed or not on PATH" >&2
    exit 1
  fi
}

check_vram() {
  local gpu="$1"
  local vram
  vram="$(gpu_vram_gb "${gpu}")"
  if [[ -z "${vram}" ]]; then
    echo "warn: unknown VRAM for ${gpu}. Run 'runpodctl gpu list' to verify." >&2
    return
  fi
  if [[ "${vram}" -lt 8 ]]; then
    echo "error: ${gpu} has ${vram}GB VRAM. qwen2.5vl:3b needs ~6GB and qwen2.5:1.5b-instruct ~2GB. Choose a GPU with at least 8GB VRAM." >&2
    exit 1
  fi
}

print_plan() {
  cat <<EOF

================================================================
  ttb-label-verification · RunPod deploy plan
================================================================
mode              : ${MODE}
git sha           : ${GIT_SHA}
local image       : $(local_image_ref)
remote image      : $(remote_image_ref)

GPU               : ${RUNPOD_GPU}
cloud type        : ${RUNPOD_CLOUD_TYPE}
container disk    : ${RUNPOD_CONTAINER_GB} GB
volume            : ${RUNPOD_VOLUME_GB} GB (mounted at /workspace)
pod name          : ${RUNPOD_POD_NAME}

expected port     : 8787 (HTTP, proxied by RunPod)
pod URL template  : https://<pod-id>-8787.proxy.runpod.net
================================================================

EOF
}

###############################################################################
# Stage: build.
###############################################################################
build_image() {
  require docker
  echo "==> building $(local_image_ref) from ${DOCKERFILE}"
  ( cd "${REPO_ROOT}" && \
    docker build \
      -f "${DOCKERFILE}" \
      -t "$(local_image_ref)" \
      .
  )
  echo "==> done: $(local_image_ref)"
}

###############################################################################
# Stage: push.
###############################################################################
push_image() {
  if [[ -z "${DOCKER_REGISTRY}" ]]; then
    echo "error: DOCKER_REGISTRY is required for --push (e.g. docker.io/yourname)" >&2
    exit 1
  fi
  require docker
  local remote
  remote="$(remote_image_ref)"
  echo "==> tagging $(local_image_ref) -> ${remote}"
  docker tag "$(local_image_ref)" "${remote}"
  echo "==> pushing ${remote}"
  docker push "${remote}"
  echo "==> done: ${remote}"
}

###############################################################################
# Stage: launch.
###############################################################################
launch_pod() {
  require runpodctl
  if [[ -z "${DOCKER_REGISTRY}" ]]; then
    echo "error: DOCKER_REGISTRY is required for --launch (RunPod pulls from a registry, not a local daemon)" >&2
    exit 1
  fi
  check_vram "${RUNPOD_GPU}"

  local remote
  remote="$(remote_image_ref)"

  # Env vars are passed as a JSON object. We mirror the ENV from the Dockerfile
  # so pod-level overrides work cleanly.
  local env_json
  env_json=$(cat <<JSON
{
  "NODE_ENV": "production",
  "PORT": "8787",
  "AI_PROVIDER": "local",
  "OLLAMA_HOST": "http://127.0.0.1:11434",
  "OLLAMA_VISION_MODEL": "qwen2.5vl:3b",
  "OLLAMA_JUDGMENT_MODEL": "qwen2.5:1.5b-instruct",
  "OLLAMA_KEEP_ALIVE": "30m",
  "OLLAMA_MAX_LOADED_MODELS": "2",
  "OCR_PREPASS": "enabled",
  "REGION_DETECTION": "disabled",
  "LLM_JUDGMENT": "enabled"
}
JSON
)

  echo "==> launching pod ${RUNPOD_POD_NAME} on ${RUNPOD_GPU} (${RUNPOD_CLOUD_TYPE})"

  local create_out
  create_out="$(runpodctl pod create \
    --image "${remote}" \
    --name "${RUNPOD_POD_NAME}" \
    --gpu-id "${RUNPOD_GPU}" \
    --gpu-count 1 \
    --cloud-type "${RUNPOD_CLOUD_TYPE}" \
    --container-disk-in-gb "${RUNPOD_CONTAINER_GB}" \
    --volume-in-gb "${RUNPOD_VOLUME_GB}" \
    --volume-mount-path "/workspace" \
    --ports "8787/http" \
    --env "${env_json}" \
    -o json)"

  echo "${create_out}"
  local pod_id
  pod_id="$(echo "${create_out}" | awk -F'"' '/"id"/ {print $4; exit}')"
  if [[ -z "${pod_id}" ]]; then
    echo "warn: could not parse pod id from create output. Use 'runpodctl pod list' to find it." >&2
    exit 1
  fi
  echo "==> pod created: ${pod_id}"

  ###############################################################################
  # Poll /api/health through the RunPod proxy until it responds.
  ###############################################################################
  local health_url="https://${pod_id}-8787.proxy.runpod.net/api/health"
  echo "==> waiting for ${health_url} (cold start with pre-pulled models ~60-120s)"
  local attempts=0
  local max_attempts=60   # 60 × 10s = 10 min
  while (( attempts < max_attempts )); do
    if curl -sf --max-time 8 "${health_url}" >/dev/null 2>&1; then
      echo "==> healthy"
      echo
      echo "Pod URL:  https://${pod_id}-8787.proxy.runpod.net"
      echo "Health:   ${health_url}"
      echo "Teardown: scripts/deploy-runpod.sh --teardown ${pod_id}"
      exit 0
    fi
    attempts=$((attempts + 1))
    sleep 10
    printf '.'
  done
  echo
  echo "warn: pod did not become healthy within 10 minutes. Check 'runpodctl pod get ${pod_id}' and the Runpod web console logs."
  exit 1
}

###############################################################################
# Stage: teardown.
###############################################################################
teardown_pod() {
  require runpodctl
  if [[ -z "${TEARDOWN_POD_ID}" ]]; then
    echo "error: --teardown requires a pod id. Use 'runpodctl pod list' to find it." >&2
    exit 1
  fi
  echo "==> stopping pod ${TEARDOWN_POD_ID}"
  runpodctl pod stop "${TEARDOWN_POD_ID}" || true
  echo "==> deleting pod ${TEARDOWN_POD_ID}"
  runpodctl pod delete "${TEARDOWN_POD_ID}"
  echo "==> done"
}

###############################################################################
# Main dispatch.
###############################################################################
case "${MODE}" in
  dry-run)
    print_plan
    echo "This was a dry run. Re-run with --build, --build --push, --launch, or --teardown <pod-id>."
    ;;
  build)
    print_plan
    build_image
    ;;
  push)
    print_plan
    push_image
    ;;
  build-push)
    print_plan
    build_image
    push_image
    ;;
  launch)
    print_plan
    build_image
    push_image
    launch_pod
    ;;
  teardown)
    teardown_pod
    ;;
  *)
    echo "error: unknown mode ${MODE}" >&2
    exit 1
    ;;
esac
