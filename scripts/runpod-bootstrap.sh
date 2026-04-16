#!/usr/bin/env bash
#
# runpod-bootstrap.sh — first-boot startup script for a RunPod pod that runs
# BOTH Ollama and the TTB Node API inside one pod, with no Docker build step.
#
# How it is executed:
#   - The pod's RunPod template sets docker-start-cmd to:
#         bash -lc 'curl -fsSL https://raw.githubusercontent.com/thisisyoussef/ttb-label-verification/main/scripts/runpod-bootstrap.sh | bash -s -- <branch>'
#   - That means: fetch this script from the repo's main branch, run it in
#     bash, optionally passing a branch name as the first positional arg.
#   - Repo is PUBLIC so no GitHub PAT is required for the clone.
#
# What it does (on every pod boot):
#   1. Install Node.js, tesseract-ocr, git, curl if missing.
#   2. Clone / fast-forward the repo into /app.
#   3. Run npm ci + npm run build (idempotent — noop if source hasn't changed).
#   4. Start ollama serve in the background; wait for it to be ready.
#   5. Ensure the VLM + judgment models are present (pull if missing).
#   6. Start the Node API in the foreground — whichever child dies first
#      propagates its exit code so RunPod's restart policy can decide.
#
# State preservation:
#   - A RunPod network volume mounted at /workspace persists across pod
#     restarts. We put both the cloned repo (/workspace/app) and the Ollama
#     model cache (/workspace/models) on it, so restarts are fast.
#   - First boot on a fresh volume takes ~5-7 min (apt install + npm ci +
#     model pull). Subsequent restarts with the warm volume are ~30-60s.
#
# Environment variables the pod expects (set via runpodctl pod create --env):
#   REPO_BRANCH            default 'main' — the branch to deploy
#   NODE_ENV               default 'production'
#   PORT                   default 8787
#   AI_PROVIDER            default 'local'
#   OLLAMA_HOST            default 'http://127.0.0.1:11434'
#   OLLAMA_VISION_MODEL    default 'qwen2.5vl:3b'
#   OLLAMA_JUDGMENT_MODEL  default 'qwen2.5:1.5b-instruct'
#   OCR_PREPASS            default 'enabled'
#   LLM_JUDGMENT           default 'disabled' (A/B showed regression — opt-in)
#   REGION_DETECTION       default 'disabled'
#   OLLAMA_MODELS          default '/workspace/models'  (goes on the volume)
#   OLLAMA_KEEP_ALIVE      default '30m'
#   OLLAMA_MAX_LOADED_MODELS default '2'
#   GEMINI_API_KEY         optional — enables cloud fallback
#   OPENAI_API_KEY         optional — enables cloud fallback

set -euo pipefail

REPO_URL="https://github.com/thisisyoussef/ttb-label-verification.git"
REPO_BRANCH="${REPO_BRANCH:-${1:-main}}"
APP_DIR="/workspace/app"
VOLUME_DIR="/workspace"

# Re-export defaults so later exec/env inherits them. Pod-level env takes
# precedence when set; these only fill in when unset.
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

log() {
  printf '[ttb-bootstrap %s] %s\n' "$(date -u +%FT%TZ)" "$*" >&2
}

###############################################################################
# 1. Install system dependencies we need that the Ollama image doesn't ship.
#
# Ollama's stock image is built on Ubuntu and has apt available. It already
# has ollama + curl. We add: node, git, tesseract.
###############################################################################
if ! command -v node >/dev/null 2>&1 \
  || ! command -v git >/dev/null 2>&1 \
  || ! command -v tesseract >/dev/null 2>&1; then
  log "installing node, git, tesseract via apt (first-boot only)"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  # Node 20 via NodeSource so we get a recent, supported version.
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
    apt-get install -y --no-install-recommends nodejs
  fi
  apt-get install -y --no-install-recommends \
    git \
    tesseract-ocr \
    tesseract-ocr-eng \
    ca-certificates
  apt-get clean
  rm -rf /var/lib/apt/lists/*
fi
log "node $(node -v 2>/dev/null || echo '?')  tesseract $(tesseract --version 2>&1 | head -1)"

###############################################################################
# 2. Clone or update the repo.
###############################################################################
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

###############################################################################
# 3. Install npm deps + build.
#
# Use --ignore-scripts because we don't want postinstall hooks (like
# hooks:install) to run inside the pod — those try to install git hooks into
# the user's dotfiles, which is pointless in a container.
###############################################################################
log "npm ci (this takes ~1-2 min first time; near-instant on warm volume)"
npm ci --ignore-scripts --no-audit --no-fund

log "npm run build"
npm run build

###############################################################################
# 4. Start Ollama in the background, wait for it to be healthy.
###############################################################################
log "starting ollama serve (models dir: ${OLLAMA_MODELS})"
mkdir -p "${OLLAMA_MODELS}"
ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!

READY_URL="${OLLAMA_HOST%/}/api/tags"
for i in $(seq 1 60); do
  if curl -sf --max-time 4 "${READY_URL}" >/dev/null 2>&1; then
    log "ollama ready after $((i*2))s"
    break
  fi
  sleep 2
  if [ "$i" -eq 60 ]; then
    log "ollama failed to come up in 120s; tail of /tmp/ollama.log:"
    tail -n 50 /tmp/ollama.log >&2 || true
    exit 1
  fi
done

###############################################################################
# 5. Ensure the two models we need are present. Pull if missing. This is a
#    no-op when the volume already has them from a prior boot.
###############################################################################
ensure_model() {
  local m="$1"
  if ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "${m}"; then
    log "model ${m} present on volume"
  else
    log "pulling ${m} (this takes 1-5 min on first boot per model)"
    ollama pull "${m}"
  fi
}
ensure_model "${OLLAMA_VISION_MODEL}"
ensure_model "${OLLAMA_JUDGMENT_MODEL}"

###############################################################################
# 6. Trap signals + start the Node API in the foreground.
###############################################################################
terminate() {
  log "SIGTERM/SIGINT received, shutting down"
  [ -n "${APP_PID:-}" ] && kill -TERM "${APP_PID}" 2>/dev/null || true
  kill -TERM "${OLLAMA_PID}" 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}
trap terminate SIGTERM SIGINT

log "starting node api on port ${PORT}"
node dist/server/index.js &
APP_PID=$!

# Whichever child dies first, we tear down both and propagate.
set +e
wait -n
EXIT_CODE=$?
log "a child exited with code ${EXIT_CODE}; tearing down"
kill -TERM "${APP_PID}"   2>/dev/null || true
kill -TERM "${OLLAMA_PID}" 2>/dev/null || true
wait 2>/dev/null || true
exit "${EXIT_CODE}"
