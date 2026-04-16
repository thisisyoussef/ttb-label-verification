#!/usr/bin/env bash
#
# deploy-app-pod.sh — deploy the FULL TTB app (Node API + Ollama + Tesseract)
# on a single RunPod GPU pod with NO Docker build on your machine.
#
# How it works (Path B, runtime git-clone):
#   - Creates (or updates) a RunPod user template named 'ttb-app'.
#   - The template uses the stock `ollama/ollama:latest` image and overrides
#     its start command with:
#         bash -lc "curl -fsSL <raw-bootstrap-url> | bash -s -- <branch>"
#   - The bootstrap script lives at
#     https://raw.githubusercontent.com/thisisyoussef/ttb-label-verification/main/scripts/runpod-bootstrap.sh
#     and handles apt-install, git clone, npm ci/build, Ollama serve, model
#     pulls, and starting the Node API. See that script for details.
#   - A network volume persists /workspace (repo clone + model cache) across
#     pod restarts so only the very first boot pays the 5-7 min setup cost.
#
# Compared to scripts/deploy-ollama-pod.sh:
#   - deploy-ollama-pod.sh runs ONLY Ollama on RunPod; the web app stays local
#     (or on Railway) and connects to the pod's Ollama over the proxy.
#   - deploy-app-pod.sh runs BOTH Ollama and the web app on RunPod. The app
#     becomes publicly reachable at
#     https://<pod-id>-8787.proxy.runpod.net
#
# Compared to scripts/deploy-runpod.sh (legacy):
#   - That script builds + pushes a custom Docker image. Requires Docker on
#     your machine. Slower per-deploy cycle (~15-20 min).
#   - This script uses a stock public image + a bootstrap URL. No Docker
#     anywhere. Deploy cycle: ~3-5 min first time, ~60s for subsequent
#     pod restarts with a warm volume.
#
# Usage:
#   scripts/deploy-app-pod.sh                          # dry-run plan
#   scripts/deploy-app-pod.sh --launch                 # create/update template
#                                                       + launch pod
#   scripts/deploy-app-pod.sh --launch --gpu "NVIDIA GeForce RTX 4090"
#   scripts/deploy-app-pod.sh --launch --branch feature/xyz
#   scripts/deploy-app-pod.sh --redeploy <pod-id>      # restart a pod so it
#                                                       re-runs the bootstrap
#                                                       (useful after you push
#                                                       new code to the branch)
#   scripts/deploy-app-pod.sh --url <pod-id>           # print app URL
#   scripts/deploy-app-pod.sh --teardown <pod-id>      # delete the pod
#                                                       (volume persists)
#
# Env var overrides:
#   RUNPOD_GPU                  default: "NVIDIA RTX A5000"
#   RUNPOD_CLOUD_TYPE           default: "COMMUNITY" (fall back to SECURE on
#                                 low stock — 2x the price but reliable)
#   RUNPOD_DATACENTER_ID        default: "US-IL-1" (has A5000 + volumes)
#   RUNPOD_VOLUME_NAME          default: "ttb-app-volume"
#   RUNPOD_VOLUME_GB            default: 30
#   RUNPOD_TEMPLATE_NAME        default: "ttb-app"
#   RUNPOD_POD_NAME             default: ttb-app-<sha>-<time>
#   REPO_BRANCH                 default: main
#   GEMINI_API_KEY              optional; passed through for cloud fallback
#   OPENAI_API_KEY              optional; passed through for cloud fallback
#
# This script NEVER launches a billable pod without an explicit --launch flag.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Base image we rebase our runtime on. Stock ollama image has Ubuntu + curl +
# the ollama binary. Our bootstrap script adds Node + Tesseract + our app.
BASE_IMAGE="${BASE_IMAGE:-ollama/ollama:latest}"

DEFAULT_GPU="NVIDIA RTX A5000"
DEFAULT_CLOUD_TYPE="COMMUNITY"
DEFAULT_DATACENTER="US-IL-1"
DEFAULT_VOLUME_NAME="ttb-app-volume"
DEFAULT_VOLUME_GB=30
DEFAULT_TEMPLATE_NAME="ttb-app"
DEFAULT_BRANCH="main"

GIT_SHA="$(cd "${REPO_ROOT}" && git rev-parse --short HEAD 2>/dev/null || echo 'nogit')"
DEFAULT_POD_NAME="ttb-app-${GIT_SHA}-$(date +%H%M%S)"

RUNPOD_GPU="${RUNPOD_GPU:-$DEFAULT_GPU}"
RUNPOD_CLOUD_TYPE="${RUNPOD_CLOUD_TYPE:-$DEFAULT_CLOUD_TYPE}"
RUNPOD_DATACENTER_ID="${RUNPOD_DATACENTER_ID:-$DEFAULT_DATACENTER}"
RUNPOD_VOLUME_NAME="${RUNPOD_VOLUME_NAME:-$DEFAULT_VOLUME_NAME}"
RUNPOD_VOLUME_GB="${RUNPOD_VOLUME_GB:-$DEFAULT_VOLUME_GB}"
RUNPOD_TEMPLATE_NAME="${RUNPOD_TEMPLATE_NAME:-$DEFAULT_TEMPLATE_NAME}"
RUNPOD_POD_NAME="${RUNPOD_POD_NAME:-$DEFAULT_POD_NAME}"
REPO_BRANCH="${REPO_BRANCH:-$DEFAULT_BRANCH}"

BOOTSTRAP_URL="https://raw.githubusercontent.com/thisisyoussef/ttb-label-verification/${REPO_BRANCH}/scripts/runpod-bootstrap.sh"

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
  sed -n '1,60p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --launch)         MODE="launch"; shift ;;
    --redeploy)
      [[ $# -ge 2 ]] || { echo "error: --redeploy requires a pod id" >&2; exit 1; }
      MODE="redeploy"; POD_ARG="$2"; shift 2 ;;
    --url)
      [[ $# -ge 2 ]] || { echo "error: --url requires a pod id" >&2; exit 1; }
      MODE="url"; POD_ARG="$2"; shift 2 ;;
    --teardown)
      [[ $# -ge 2 ]] || { echo "error: --teardown requires a pod id" >&2; exit 1; }
      MODE="teardown"; POD_ARG="$2"; shift 2 ;;
    --gpu)
      [[ $# -ge 2 ]] || { echo "error: --gpu requires a GPU name" >&2; exit 1; }
      RUNPOD_GPU="$2"; shift 2 ;;
    --cloud)
      [[ $# -ge 2 ]] || { echo "error: --cloud requires SECURE or COMMUNITY" >&2; exit 1; }
      RUNPOD_CLOUD_TYPE="$2"; shift 2 ;;
    --datacenter)
      [[ $# -ge 2 ]] || { echo "error: --datacenter requires a DC id" >&2; exit 1; }
      RUNPOD_DATACENTER_ID="$2"; shift 2 ;;
    --branch)
      [[ $# -ge 2 ]] || { echo "error: --branch requires a branch name" >&2; exit 1; }
      REPO_BRANCH="$2"
      BOOTSTRAP_URL="https://raw.githubusercontent.com/thisisyoussef/ttb-label-verification/${REPO_BRANCH}/scripts/runpod-bootstrap.sh"
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
# Helpers.
###############################################################################
section() {
  echo >&2
  echo "============================================================" >&2
  echo "  $*" >&2
  echo "============================================================" >&2
}

proxy_url() {
  local pod_id="$1"
  local port="${2:-8787}"
  echo "https://${pod_id}-${port}.proxy.runpod.net"
}

# Find or create the network volume. Returns the volume id on stdout.
ensure_volume() {
  require runpodctl
  local existing_id
  existing_id="$(
    runpodctl network-volume list 2>/dev/null \
      | awk -v name="${RUNPOD_VOLUME_NAME}" '
          /"id":/ { id = $2; gsub(/[",]/, "", id) }
          /"name":/ { n = $2; gsub(/[",]/, "", n); if (n == name) print id }
        ' | head -1
  )" || true
  if [[ -n "${existing_id}" ]]; then
    echo "${existing_id}"
    return 0
  fi
  section "Creating network volume ${RUNPOD_VOLUME_NAME} (${RUNPOD_VOLUME_GB} GB in ${RUNPOD_DATACENTER_ID})"
  runpodctl network-volume create \
    --name "${RUNPOD_VOLUME_NAME}" \
    --size "${RUNPOD_VOLUME_GB}" \
    --data-center-id "${RUNPOD_DATACENTER_ID}" \
    | awk -F'"' '/"id"/ {print $4; exit}'
}

# Find or create the user template. Returns the template id.
# The template's docker-start-cmd does the 'curl | bash' trick to pull the
# bootstrap script from the branch at request time, so you don't have to
# rebuild the template to ship new code — a pod --redeploy is enough.
ensure_template() {
  require runpodctl
  local existing_id
  existing_id="$(
    runpodctl template list --type user 2>/dev/null \
      | awk -v name="${RUNPOD_TEMPLATE_NAME}" '
          /"id":/ { id = $2; gsub(/[",]/, "", id) }
          /"name":/ { n = $2; gsub(/[",]/, "", n); if (n == name) print id }
        ' | head -1
  )" || true
  if [[ -n "${existing_id}" ]]; then
    echo "${existing_id}"
    return 0
  fi

  section "Creating user template ${RUNPOD_TEMPLATE_NAME}"
  # docker-start-cmd is comma-separated. Passing 'bash,-lc,<cmd>' runs the
  # <cmd> string under bash -l (login shell) -c.
  # Using printf %q to escape nothing here because the command is a fixed
  # literal — no user input, no special shell chars beyond the pipe which is
  # safe inside the bash -c string.
  local start_cmd="curl -fsSL ${BOOTSTRAP_URL} | bash -s -- ${REPO_BRANCH}"
  runpodctl template create \
    --name "${RUNPOD_TEMPLATE_NAME}" \
    --image "${BASE_IMAGE}" \
    --container-disk-in-gb 20 \
    --volume-in-gb "${RUNPOD_VOLUME_GB}" \
    --volume-mount-path "/workspace" \
    --ports "8787/http,11434/http" \
    --docker-entrypoint "bash,-lc" \
    --docker-start-cmd "${start_cmd}" \
    --env "$(cat <<JSON
{
  "REPO_BRANCH": "${REPO_BRANCH}",
  "NODE_ENV": "production",
  "PORT": "8787",
  "AI_PROVIDER": "local",
  "OLLAMA_HOST": "http://127.0.0.1:11434",
  "OLLAMA_VISION_MODEL": "qwen2.5vl:3b",
  "OLLAMA_JUDGMENT_MODEL": "qwen2.5:1.5b-instruct",
  "OLLAMA_MODELS": "/workspace/models",
  "OLLAMA_KEEP_ALIVE": "30m",
  "OLLAMA_MAX_LOADED_MODELS": "2",
  "OCR_PREPASS": "enabled",
  "LLM_JUDGMENT": "disabled",
  "REGION_DETECTION": "disabled"
}
JSON
)" \
    | awk -F'"' '/"id"/ {print $4; exit}'
}

###############################################################################
# Mode dispatch.
###############################################################################
case "${MODE}" in

  dry-run)
    cat <<EOF
RunPod no-Docker app pod — dry-run plan
============================================================
template name     : ${RUNPOD_TEMPLATE_NAME}
base image        : ${BASE_IMAGE} (stock; not built by us)
bootstrap URL     : ${BOOTSTRAP_URL}
branch            : ${REPO_BRANCH}

GPU               : ${RUNPOD_GPU}
cloud type        : ${RUNPOD_CLOUD_TYPE}
datacenter        : ${RUNPOD_DATACENTER_ID}
volume name       : ${RUNPOD_VOLUME_NAME} (${RUNPOD_VOLUME_GB} GB @ /workspace)
pod name          : ${RUNPOD_POD_NAME}

exposed ports     : 8787 (Node API), 11434 (Ollama)

Proxy URLs after launch:
  app             : https://<pod-id>-8787.proxy.runpod.net
  ollama          : https://<pod-id>-11434.proxy.runpod.net

Re-run with --launch. No billable resources are created in dry-run.
EOF
    ;;

  launch)
    require runpodctl
    section "Step 1: ensure network volume"
    volume_id="$(ensure_volume)"
    echo "volume id: ${volume_id}" >&2

    section "Step 2: ensure template"
    template_id="$(ensure_template)"
    echo "template id: ${template_id}" >&2

    section "Step 3: create pod"
    # Pass GEMINI_API_KEY / OPENAI_API_KEY through to the pod if set in the
    # caller's environment. These are optional — enable cloud fallback mode.
    local_env_json=$(python3 - <<PY
import json, os
env = {
  "REPO_BRANCH": "${REPO_BRANCH}",
}
for k in ("GEMINI_API_KEY","OPENAI_API_KEY"):
    v = os.environ.get(k)
    if v:
        env[k] = v
print(json.dumps(env))
PY
)
    create_out="$(runpodctl pod create \
      --template-id "${template_id}" \
      --name "${RUNPOD_POD_NAME}" \
      --gpu-id "${RUNPOD_GPU}" \
      --gpu-count 1 \
      --cloud-type "${RUNPOD_CLOUD_TYPE}" \
      --data-center-ids "${RUNPOD_DATACENTER_ID}" \
      --network-volume-id "${volume_id}" \
      --volume-mount-path "/workspace" \
      --env "${local_env_json}" \
      -o json)"
    echo "${create_out}"
    pod_id="$(echo "${create_out}" | awk -F'"' '/"id"/ {print $4; exit}')"
    [[ -n "${pod_id}" ]] || { echo "error: failed to parse pod id" >&2; exit 1; }

    app_url="$(proxy_url "${pod_id}" 8787)"
    ollama_url="$(proxy_url "${pod_id}" 11434)"

    section "Step 4: poll app health at ${app_url}/api/health"
    # First boot on a fresh volume: ~5-7 min (apt install + npm ci + model
    # pulls). Warm-volume boots: ~60-90s. Budget 15 min total.
    attempts=0
    max_attempts=90
    until curl -sf --max-time 8 "${app_url}/api/health" >/dev/null 2>&1; do
      attempts=$((attempts + 1))
      if (( attempts >= max_attempts )); then
        echo >&2
        echo "warn: app did not return 200 within 15 minutes." >&2
        echo "Inspect the pod's container logs via RunPod web console or" >&2
        echo "  runpodctl pod get ${pod_id}" >&2
        exit 1
      fi
      sleep 10
      printf '.' >&2
    done
    echo >&2

    section "App is live"
    cat <<EOF

Pod id       : ${pod_id}
App URL      : ${app_url}
Health       : ${app_url}/api/health
Ollama URL   : ${ollama_url}

Update branch (re-clones on pod, ~30-60s if volume warm):
  scripts/deploy-app-pod.sh --redeploy ${pod_id}

Teardown (IMPORTANT — billed per second):
  scripts/deploy-app-pod.sh --teardown ${pod_id}
EOF
    ;;

  redeploy)
    require runpodctl
    section "Restarting pod ${POD_ARG} so it re-runs the bootstrap"
    runpodctl pod restart "${POD_ARG}"
    echo "pod restarted. watch 'runpodctl pod get ${POD_ARG}' for status." >&2
    ;;

  url)
    echo "app:    $(proxy_url "${POD_ARG}" 8787)"
    echo "ollama: $(proxy_url "${POD_ARG}" 11434)"
    ;;

  teardown)
    require runpodctl
    section "Deleting pod ${POD_ARG}"
    runpodctl pod delete "${POD_ARG}"
    echo "Volume '${RUNPOD_VOLUME_NAME}' is kept. To delete it too:" >&2
    echo "  runpodctl network-volume list  # find the id" >&2
    echo "  runpodctl network-volume delete <volume-id>" >&2
    ;;

esac
