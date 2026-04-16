#!/usr/bin/env bash
#
# deploy-ollama-pod.sh — launch a RunPod GPU pod running Ollama with our two
# models pre-pulled, and print the proxy URL for the TTB app to point at.
#
# This is the **no-Docker** deployment path (our preferred default).
#
# How it differs from scripts/deploy-runpod.sh:
#   - That script builds a custom image with the Node API + Ollama bundled,
#     pushes to Docker Hub, and runs them together on the pod.
#   - This script uses RunPod's official Ollama template directly. The TTB
#     app runs locally (or on Railway) and points at the pod's Ollama over
#     RunPod's HTTPS proxy. No Docker activity happens on your machine.
#
# When to use which:
#   - Use THIS script when: you just need a GPU Ollama endpoint for the TTB
#     app to consume. You're iterating fast on app code and don't want to
#     rebuild/push an image every time. The app stays wherever it already is.
#   - Use deploy-runpod.sh when: you want the app itself to ship to RunPod
#     (e.g. moving off Railway), or when cold-start latency has to be under
#     a few seconds and you want models baked into the image.
#
# Usage:
#   scripts/deploy-ollama-pod.sh                                 # dry-run plan
#   scripts/deploy-ollama-pod.sh --launch                        # create pod
#   scripts/deploy-ollama-pod.sh --launch --gpu "NVIDIA L4"      # alt GPU
#   scripts/deploy-ollama-pod.sh --pull-models <pod-id>          # pull into
#                                                                  running pod
#   scripts/deploy-ollama-pod.sh --url <pod-id>                   # print URL
#   scripts/deploy-ollama-pod.sh --teardown <pod-id>              # delete pod
#   scripts/deploy-ollama-pod.sh --list-volumes                   # existing
#                                                                  volumes
#
# Env var overrides (all optional):
#   RUNPOD_GPU                default: "NVIDIA RTX A5000"
#   RUNPOD_CLOUD_TYPE         default: "COMMUNITY" (SECURE is ~2x the price)
#   RUNPOD_DATACENTER_ID      default: "US-CA-2" (has A5000 and 4090 stock)
#   RUNPOD_VOLUME_NAME        default: "ttb-ollama-cache"
#   RUNPOD_VOLUME_GB          default: 15 (~3GB Qwen2.5-VL-3B + 1GB Qwen2.5-1.5B
#                                          + headroom for a second VLM)
#   RUNPOD_POD_NAME           default: ttb-ollama-$(git sha)
#   OLLAMA_VISION_MODEL       default: qwen2.5vl:3b
#   OLLAMA_JUDGMENT_MODEL     default: qwen2.5:1.5b-instruct
#
# This script NEVER creates a billable pod without an explicit --launch flag.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# RunPod's official "Ollama NVIDIA CUDA" template. Verified via
# `runpodctl template search ollama`. Image: ollama/ollama:latest.
OLLAMA_TEMPLATE_ID="${OLLAMA_TEMPLATE_ID:-e2wsrsjbjq}"

DEFAULT_GPU="NVIDIA RTX A5000"
DEFAULT_CLOUD_TYPE="COMMUNITY"
DEFAULT_DATACENTER="US-IL-1"
DEFAULT_VOLUME_NAME="ttb-ollama-cache"
DEFAULT_VOLUME_GB=15

GIT_SHA="$(cd "${REPO_ROOT}" && git rev-parse --short HEAD 2>/dev/null || echo 'nogit')"
DEFAULT_POD_NAME="ttb-ollama-${GIT_SHA}-$(date +%H%M%S)"

RUNPOD_GPU="${RUNPOD_GPU:-$DEFAULT_GPU}"
RUNPOD_CLOUD_TYPE="${RUNPOD_CLOUD_TYPE:-$DEFAULT_CLOUD_TYPE}"
RUNPOD_DATACENTER_ID="${RUNPOD_DATACENTER_ID:-$DEFAULT_DATACENTER}"
RUNPOD_VOLUME_NAME="${RUNPOD_VOLUME_NAME:-$DEFAULT_VOLUME_NAME}"
RUNPOD_VOLUME_GB="${RUNPOD_VOLUME_GB:-$DEFAULT_VOLUME_GB}"
RUNPOD_POD_NAME="${RUNPOD_POD_NAME:-$DEFAULT_POD_NAME}"
OLLAMA_VISION_MODEL="${OLLAMA_VISION_MODEL:-qwen2.5vl:3b}"
OLLAMA_JUDGMENT_MODEL="${OLLAMA_JUDGMENT_MODEL:-qwen2.5:1.5b-instruct}"

###############################################################################
# CLI parsing.
###############################################################################
MODE="dry-run"
POD_ARG=""

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: '$1' not found in PATH" >&2
    exit 1
  }
}

print_usage() {
  # Echo the usage block verbatim from the top of the file.
  sed -n '1,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --launch)
      MODE="launch"; shift ;;
    --pull-models)
      if [[ $# -lt 2 ]]; then
        echo "error: --pull-models requires a pod id" >&2
        exit 1
      fi
      MODE="pull"; POD_ARG="$2"; shift 2 ;;
    --url)
      if [[ $# -lt 2 ]]; then
        echo "error: --url requires a pod id" >&2
        exit 1
      fi
      MODE="url"; POD_ARG="$2"; shift 2 ;;
    --teardown)
      if [[ $# -lt 2 ]]; then
        echo "error: --teardown requires a pod id" >&2
        exit 1
      fi
      MODE="teardown"; POD_ARG="$2"; shift 2 ;;
    --list-volumes)
      MODE="list-volumes"; shift ;;
    --gpu)
      if [[ $# -lt 2 ]]; then
        echo "error: --gpu requires a GPU name" >&2
        exit 1
      fi
      RUNPOD_GPU="$2"; shift 2 ;;
    --datacenter)
      if [[ $# -lt 2 ]]; then
        echo "error: --datacenter requires a datacenter id" >&2
        exit 1
      fi
      RUNPOD_DATACENTER_ID="$2"; shift 2 ;;
    -h|--help)
      print_usage; exit 0 ;;
    *)
      echo "unknown flag: $1" >&2
      print_usage
      exit 1 ;;
  esac
done

###############################################################################
# Helpers.
###############################################################################
# Print a labeled bar to stderr so it's visible when the rest of the output is
# piped to jq or tee.
section() {
  echo >&2
  echo "============================================================" >&2
  echo "  $*" >&2
  echo "============================================================" >&2
}

# Find or create the network volume that will hold /root/.ollama.
# Returns the volume id on stdout.
ensure_volume() {
  require runpodctl
  local existing_id
  existing_id="$(
    runpodctl network-volume list 2>/dev/null \
      | awk -v name="${RUNPOD_VOLUME_NAME}" '
          BEGIN { in_obj = 0 }
          /"id":/ { id = $2; gsub(/[",]/, "", id) }
          /"name":/ { n = $2; gsub(/[",]/, "", n); if (n == name) print id }
        ' | head -1
  )" || true

  if [[ -n "${existing_id}" ]]; then
    echo "${existing_id}"
    return 0
  fi

  section "Creating network volume ${RUNPOD_VOLUME_NAME} (${RUNPOD_VOLUME_GB} GB in ${RUNPOD_DATACENTER_ID})"
  local out
  out="$(runpodctl network-volume create \
    --name "${RUNPOD_VOLUME_NAME}" \
    --size "${RUNPOD_VOLUME_GB}" \
    --data-center-id "${RUNPOD_DATACENTER_ID}")"
  echo "${out}" | awk -F'"' '/"id"/ {print $4; exit}'
}

proxy_url() {
  local pod_id="$1"
  echo "https://${pod_id}-11434.proxy.runpod.net"
}

###############################################################################
# Mode dispatch.
###############################################################################
case "${MODE}" in

  dry-run)
    cat <<EOF
RunPod no-Docker Ollama pod — dry-run plan
============================================================
template id       : ${OLLAMA_TEMPLATE_ID}  (RunPod official 'Ollama NVIDIA CUDA')
image             : ollama/ollama:latest (pulled by RunPod, not by you)

GPU               : ${RUNPOD_GPU}
cloud type        : ${RUNPOD_CLOUD_TYPE}
datacenter        : ${RUNPOD_DATACENTER_ID}
volume name       : ${RUNPOD_VOLUME_NAME} (${RUNPOD_VOLUME_GB} GB)
volume mount path : /root/.ollama         (persists across pod restarts)
pod name          : ${RUNPOD_POD_NAME}

models to pull    : ${OLLAMA_VISION_MODEL}
                    ${OLLAMA_JUDGMENT_MODEL}

After launch, set your local app env:
  export AI_PROVIDER=local
  export OLLAMA_HOST=https://<pod-id>-11434.proxy.runpod.net
  export OLLAMA_VISION_MODEL=${OLLAMA_VISION_MODEL}
  export OLLAMA_JUDGMENT_MODEL=${OLLAMA_JUDGMENT_MODEL}

Re-run with --launch to create the pod. NEVER does anything billable in dry-run.
EOF
    ;;

  launch)
    require runpodctl
    section "Step 1: ensure network volume exists"
    volume_id="$(ensure_volume)"
    echo "volume id: ${volume_id}" >&2

    section "Step 2: create pod (GPU=${RUNPOD_GPU}, datacenter=${RUNPOD_DATACENTER_ID})"
    create_out="$(runpodctl pod create \
      --template-id "${OLLAMA_TEMPLATE_ID}" \
      --name "${RUNPOD_POD_NAME}" \
      --gpu-id "${RUNPOD_GPU}" \
      --gpu-count 1 \
      --cloud-type "${RUNPOD_CLOUD_TYPE}" \
      --data-center-ids "${RUNPOD_DATACENTER_ID}" \
      --network-volume-id "${volume_id}" \
      --volume-mount-path "/root/.ollama" \
      --ports "11434/http" \
      -o json)"
    echo "${create_out}"
    pod_id="$(echo "${create_out}" | awk -F'"' '/"id"/ {print $4; exit}')"
    if [[ -z "${pod_id}" ]]; then
      echo "error: could not parse pod id from create output" >&2
      exit 1
    fi

    url="$(proxy_url "${pod_id}")"
    section "Step 3: wait for Ollama to be reachable at ${url}/api/tags"
    local_attempts=0
    max_attempts=60 # 60 × 10s = 10 min
    until curl -sf --max-time 8 "${url}/api/tags" >/dev/null 2>&1; do
      local_attempts=$((local_attempts + 1))
      if (( local_attempts >= max_attempts )); then
        echo "warn: Ollama did not respond within 10 min. Pod may still be booting." >&2
        echo "Check 'runpodctl pod get ${pod_id}' and RunPod web console logs." >&2
        exit 1
      fi
      sleep 10
      printf '.' >&2
    done
    echo >&2

    section "Step 4: pull models (one-time per volume — subsequent boots skip)"
    for model in "${OLLAMA_VISION_MODEL}" "${OLLAMA_JUDGMENT_MODEL}"; do
      echo "pulling ${model}..." >&2
      curl -sS -X POST "${url}/api/pull" \
        -H 'content-type: application/json' \
        -d "{\"model\":\"${model}\",\"stream\":false}" \
        --max-time 900 \
        | tail -2 >&2 || {
          echo "warn: pull of ${model} failed; the pod is up but you may need to retry with --pull-models ${pod_id}" >&2
        }
    done

    section "Pod is live"
    cat <<EOF

Pod id      : ${pod_id}
Ollama URL  : ${url}
Health      : ${url}/api/tags

Local app env (copy into .env):
  AI_PROVIDER=local
  OLLAMA_HOST=${url}
  OLLAMA_VISION_MODEL=${OLLAMA_VISION_MODEL}
  OLLAMA_JUDGMENT_MODEL=${OLLAMA_JUDGMENT_MODEL}

Quick test:
  curl -sS ${url}/api/tags | python3 -m json.tool

Teardown (remember — billed by the second):
  scripts/deploy-ollama-pod.sh --teardown ${pod_id}

Model re-pull (if volume got wiped):
  scripts/deploy-ollama-pod.sh --pull-models ${pod_id}
EOF
    ;;

  pull)
    require runpodctl
    url="$(proxy_url "${POD_ARG}")"
    section "Pulling models into pod ${POD_ARG} via ${url}"
    for model in "${OLLAMA_VISION_MODEL}" "${OLLAMA_JUDGMENT_MODEL}"; do
      echo "pulling ${model}..."
      curl -sS -X POST "${url}/api/pull" \
        -H 'content-type: application/json' \
        -d "{\"model\":\"${model}\",\"stream\":false}" \
        --max-time 900 | tail -2
    done
    ;;

  url)
    proxy_url "${POD_ARG}"
    ;;

  teardown)
    require runpodctl
    section "Tearing down pod ${POD_ARG}"
    runpodctl pod delete "${POD_ARG}"
    echo "NOTE: the network volume '${RUNPOD_VOLUME_NAME}' is NOT deleted. Subsequent pods reuse it." >&2
    echo "To delete the volume manually: runpodctl network-volume delete <volume-id>" >&2
    ;;

  list-volumes)
    require runpodctl
    runpodctl network-volume list
    ;;

esac
