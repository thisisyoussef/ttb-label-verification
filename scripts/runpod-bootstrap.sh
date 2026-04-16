#!/usr/bin/env bash
#
# runpod-bootstrap.sh — first-boot startup script for a RunPod pod that runs
# BOTH Ollama and the TTB Node API inside one pod, with no Docker build step.
#
# DESIGN NOTES for the recovery after the April 2026 silent-failure incident:
#
#   The template's docker-start-cmd is now two-phase:
#     phase 1: `ollama serve` starts in the background, unconditional.
#              This guarantees the pod is reachable on 11434 within ~2s of
#              container start, even if the bootstrap below explodes.
#     phase 2: this bootstrap.sh runs, redirecting ALL output to
#              /workspace/bootstrap.log (persists on the volume so it survives
#              pod restarts) AND /tmp/bootstrap.log (readable via SSH panel).
#     phase 3: if the Node API never starts, the start-cmd falls through to
#              `sleep infinity` so the container stays up and you can SSH in
#              to read the log.
#
#   You'll find the full start-cmd in scripts/deploy-app-pod.sh — that's the
#   wrapper. This file is the second stage.
#
# How it is executed:
#   - The pod's template start-cmd first starts Ollama, then curls this file
#     from the branch's main and pipes to bash.
#   - Repo is PUBLIC so no GitHub PAT is required.
#
# Environment variables the pod expects (set via runpodctl pod create --env):
#   REPO_BRANCH              default 'main'
#   NODE_ENV                 default 'production'
#   PORT                     default 8787
#   AI_PROVIDER              default 'local'
#   OLLAMA_HOST              default 'http://127.0.0.1:11434'
#   OLLAMA_VISION_MODEL      default 'qwen2.5vl:3b'
#   OLLAMA_JUDGMENT_MODEL    default 'qwen2.5:1.5b-instruct'
#   OCR_PREPASS              default 'enabled'
#   LLM_JUDGMENT             default 'disabled'
#   REGION_DETECTION         default 'disabled'
#   OLLAMA_MODELS            default '/workspace/models'
#   OLLAMA_KEEP_ALIVE        default '30m'
#   OLLAMA_MAX_LOADED_MODELS default '2'
#   GEMINI_API_KEY           optional
#   OPENAI_API_KEY           optional

# ----------------------------------------------------------------------------
# Step 0 — make every subsequent line visible in /workspace/bootstrap.log.
# Before this point any output is lost. That's why we don't put heavy work
# in the template's start-cmd — all of it lives here.
# ----------------------------------------------------------------------------
mkdir -p /workspace
# Tee to both the volume (survives restarts) and stderr (RunPod web console).
# We use `exec` so every subsequent command in this script inherits the fds.
exec > >(tee -a /workspace/bootstrap.log) 2>&1

log() {
  printf '[ttb-bootstrap %s] %s\n' "$(date -u +%FT%TZ)" "$*"
}

on_error() {
  local exit_code=$?
  local line_no=$1
  log "FATAL: step failed at line ${line_no} with exit ${exit_code}"
  log "see /workspace/bootstrap.log for details"
  # Leave a breadcrumb the deploy script can check for
  echo "failed-at-line-${line_no}-exit-${exit_code}" > /workspace/bootstrap.status
  # Do NOT exit; caller (template start-cmd) will handle keeping the pod alive.
  exit "${exit_code}"
}
trap 'on_error ${LINENO}' ERR

set -uo pipefail
# NOTE: we intentionally do NOT use `set -e` because apt-get returns non-zero
# in cases that are still recoverable (mirror flap). We handle errors via the
# ERR trap + explicit checks.

log "=============================================================="
log "TTB bootstrap starting"
log "branch=${1:-main}  pid=$$  uid=$(id -u)  cwd=$(pwd)"
log "=============================================================="

REPO_URL="https://github.com/thisisyoussef/ttb-label-verification.git"
REPO_BRANCH="${REPO_BRANCH:-${1:-main}}"
APP_DIR="/workspace/app"
VOLUME_DIR="/workspace"

# Re-export defaults so later exec/env inherits them.
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-8787}"
export AI_PROVIDER="${AI_PROVIDER:-local}"
export OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
export OLLAMA_VISION_MODEL="${OLLAMA_VISION_MODEL:-qwen2.5vl:3b}"
export OLLAMA_JUDGMENT_MODEL="${OLLAMA_JUDGMENT_MODEL:-qwen2.5:1.5b-instruct}"
export OCR_PREPASS="${OCR_PREPASS:-enabled}"
export LLM_JUDGMENT="${LLM_JUDGMENT:-disabled}"
export REGION_DETECTION="${REGION_DETECTION:-disabled}"
export OLLAMA_MODELS="${OLLAMA_MODELS:-/workspace/models}"
export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-30m}"
export OLLAMA_MAX_LOADED_MODELS="${OLLAMA_MAX_LOADED_MODELS:-2}"

# ----------------------------------------------------------------------------
# Step 1 — install system dependencies we need that the Ollama image doesn't
# ship. Each install step logs before it runs.
#
# The Ollama base image is Ubuntu 22.04 and ships curl + bash + apt. It does
# NOT ship node, git, or tesseract. We install them unconditionally at first
# boot; apt turns subsequent runs into near-no-ops (~5s).
# ----------------------------------------------------------------------------
echo "step-1-deps" > /workspace/bootstrap.status
log "STEP 1/5: installing system deps (node, git, tesseract)"

export DEBIAN_FRONTEND=noninteractive
log "apt-get update"
apt-get update -qq || log "warn: apt-get update had a non-zero exit; continuing"

if ! command -v git >/dev/null 2>&1; then
  log "installing git"
  apt-get install -y --no-install-recommends git ca-certificates
fi

if ! command -v tesseract >/dev/null 2>&1; then
  log "installing tesseract-ocr"
  apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng
fi

if ! command -v node >/dev/null 2>&1; then
  log "installing node 20 via NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y --no-install-recommends nodejs
fi

log "versions:"
log "  node      $(node -v 2>/dev/null || echo 'missing')"
log "  npm       $(npm -v 2>/dev/null || echo 'missing')"
log "  git       $(git --version 2>/dev/null || echo 'missing')"
log "  tesseract $(tesseract --version 2>&1 | head -1 || echo 'missing')"
log "  ollama    $(ollama --version 2>&1 | head -1 || echo 'missing')"

apt-get clean || true
rm -rf /var/lib/apt/lists/* || true

# ----------------------------------------------------------------------------
# Step 2 — clone / update the repo.
# ----------------------------------------------------------------------------
echo "step-2-clone" > /workspace/bootstrap.status
log "STEP 2/5: clone/update repo (${REPO_BRANCH})"
mkdir -p "${VOLUME_DIR}"
if [ -d "${APP_DIR}/.git" ]; then
  log "repo exists; fetching + resetting to ${REPO_BRANCH}"
  cd "${APP_DIR}"
  git fetch --depth 1 origin "${REPO_BRANCH}"
  git reset --hard "origin/${REPO_BRANCH}"
else
  log "cloning ${REPO_URL} (${REPO_BRANCH}) into ${APP_DIR}"
  git clone --depth 1 --branch "${REPO_BRANCH}" "${REPO_URL}" "${APP_DIR}"
  cd "${APP_DIR}"
fi
log "head: $(git rev-parse --short HEAD)  msg: $(git log -1 --pretty=%s)"

# ----------------------------------------------------------------------------
# Step 3 — npm ci + build. --ignore-scripts skips husky git-hook installs that
# are pointless in a container and can fail on detached HEAD.
# ----------------------------------------------------------------------------
echo "step-3-build" > /workspace/bootstrap.status
log "STEP 3/5: npm ci + build"
npm ci --ignore-scripts --no-audit --no-fund
npm run build

# ----------------------------------------------------------------------------
# Step 4 — verify Ollama is up (started by the template's start-cmd before
# this script ran). Poll until /api/tags responds.
# ----------------------------------------------------------------------------
echo "step-4-ollama" > /workspace/bootstrap.status
log "STEP 4/5: wait for ollama serve (started by template start-cmd)"

READY_URL="${OLLAMA_HOST%/}/api/tags"
OLLAMA_OK=false
for i in $(seq 1 60); do
  if curl -sf --max-time 4 "${READY_URL}" >/dev/null 2>&1; then
    log "ollama ready after $((i*2))s"
    OLLAMA_OK=true
    break
  fi
  sleep 2
done

if [ "${OLLAMA_OK}" != "true" ]; then
  log "WARN: ollama did not respond on ${READY_URL} in 120s"
  log "      pod will still come up but extraction will fail until Ollama starts"
  log "      check /tmp/ollama.log via SSH for the underlying reason"
fi

ensure_model() {
  local m="$1"
  if ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "${m}"; then
    log "model ${m} present on volume"
  else
    log "pulling ${m} (first boot takes 1-5 min per model)"
    ollama pull "${m}" || log "warn: pull of ${m} failed; app will retry at runtime"
  fi
}
if [ "${OLLAMA_OK}" = "true" ]; then
  ensure_model "${OLLAMA_VISION_MODEL}"
  ensure_model "${OLLAMA_JUDGMENT_MODEL}"
fi

# ----------------------------------------------------------------------------
# Step 5 — start the Node API in the foreground. RunPod's process supervisor
# watches PID 1; when this dies the container restarts per the pod policy.
# ----------------------------------------------------------------------------
echo "step-5-node" > /workspace/bootstrap.status
log "STEP 5/5: starting node dist/server/index.js on port ${PORT}"
log "env AI_PROVIDER=${AI_PROVIDER} OCR_PREPASS=${OCR_PREPASS} LLM_JUDGMENT=${LLM_JUDGMENT}"

# Use exec so the node process becomes PID 1 of the bootstrap wrapper,
# inheriting signal handling from the shell.
echo "running" > /workspace/bootstrap.status
exec node dist/server/index.js
