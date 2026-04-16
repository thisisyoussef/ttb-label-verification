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

# ----------------------------------------------------------------------------
# Step 0b — start ollama in the background, unconditionally.
#
# We moved this OUT of the template's docker-start-cmd (where it previously
# lived as `ollama serve >/tmp/ollama.log 2>&1 &`). Experimentation showed
# that longer start-cmd strings — with `&` backgrounding + pipes + `;` +
# `exec` — fail silently on RunPod. The debug template that did a single
# `apt-get && install && sshd -D` worked; anything fancier didn't.
#
# Solution: keep the template's start-cmd trivial (just
# `bash -c "curl -s <URL> | bash"`) and put all sequencing HERE, where we
# control it and can see the logs.
# ----------------------------------------------------------------------------
if ! pgrep -x ollama >/dev/null 2>&1; then
  ollama serve > /tmp/ollama.log 2>&1 &
  echo "step-0b-ollama-pid-$!" > /workspace/bootstrap.status
fi

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
# Latency + concurrency tuning, sized for a 32GB GPU (RTX 5090):
#
# VRAM budget on 5090:
#   qwen2.5vl:3b weights           ~4.0 GB
#   qwen2.5:1.5b-instruct weights  ~1.5 GB
#   VLM KV cache  per slot @8K ctx ~1.5 GB
#   Judgment KV   per slot @8K ctx ~0.5 GB
#   With NUM_PARALLEL=8:
#     4 + 8×1.5 + 1.5 + 8×0.5 = 21.5 GB  (10 GB headroom)
#
# Knobs and why:
#   FlashAttention: 30-50% speedup on VLM attention. Off by default in
#     Ollama — no reason not to use it with a modern GPU.
#   NumParallel=2: let Ollama handle 2 concurrent inference requests
#     per model. Measured empirically: NUM_PARALLEL=8 caused eval
#     regression (24/28 -> 19/28, 2 -> 7 errors) because the scheduler
#     allocated KV cache it couldn't back with real throughput, AND
#     because uneven token lengths across real labels defeat batched
#     inference efficiency. NUM_PARALLEL=2 gives graceful concurrency
#     for 2 simultaneous users without tanking accuracy. For bulk
#     batch workflows we'll want a dedicated inference server (vLLM
#     or SGLang) that does true continuous batching — a follow-up
#     item, not the right fix for today.
#   MaxLoadedModels=2: VLM + judgment model. A third would evict
#     one of the existing two (VRAM budget) and cause cold-start tax.
#   ContextLength=8192: labels use 2-4K prompt tokens + 1K output; the
#     default 32768 wastes KV cache memory.
#   KeepAlive=60m: once a model is on the GPU, keep it there for an
#     hour of idle. A demo/batch session is well within that window.
#   JudgmentTimeout=30s: default 10s is too tight for cold starts
#     (observed 502s in the golden eval). 30s bounds stuck requests
#     without being reachable in normal flow.
export OLLAMA_FLASH_ATTENTION="${OLLAMA_FLASH_ATTENTION:-1}"
export OLLAMA_NUM_PARALLEL="${OLLAMA_NUM_PARALLEL:-2}"
export OLLAMA_MAX_LOADED_MODELS="${OLLAMA_MAX_LOADED_MODELS:-2}"
export OLLAMA_CONTEXT_LENGTH="${OLLAMA_CONTEXT_LENGTH:-8192}"
export OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-60m}"
export OLLAMA_JUDGMENT_TIMEOUT_MS="${OLLAMA_JUDGMENT_TIMEOUT_MS:-30000}"
export OLLAMA_JUDGMENT_KEEP_ALIVE="${OLLAMA_JUDGMENT_KEEP_ALIVE:-60m}"

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

# Install and start sshd so we can SSH in to read /workspace/bootstrap.log
# when the app fails to come up. RunPod's SSH docs confirm that the
# ollama/ollama base image does NOT ship sshd — we have to install it
# ourselves: https://docs.runpod.io/pods/configuration/use-ssh
if ! command -v sshd >/dev/null 2>&1 && ! [ -x /usr/sbin/sshd ]; then
  log "installing openssh-server for debug SSH access"
  apt-get install -y --no-install-recommends openssh-server
fi

# Start sshd once, against the injected PUBLIC_KEY (RunPod populates this
# env var from the account's configured keys). The daemon keeps running in
# the background and listens on port 22; RunPod exposes it on the Connect
# tab in the web console.
if [ -n "${PUBLIC_KEY:-}" ]; then
  mkdir -p /root/.ssh
  chmod 700 /root/.ssh
  if ! grep -qF "${PUBLIC_KEY}" /root/.ssh/authorized_keys 2>/dev/null; then
    echo "${PUBLIC_KEY}" >> /root/.ssh/authorized_keys
  fi
  chmod 600 /root/.ssh/authorized_keys
  mkdir -p /var/run/sshd
  if ! pgrep -x sshd >/dev/null 2>&1; then
    log "starting sshd on port 22"
    /usr/sbin/sshd -D &
    SSHD_PID=$!
    log "sshd pid=${SSHD_PID}"
  fi
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
# Step 3 — npm ci + build.
#
# --ignore-scripts : skip husky git-hook installs (pointless in containers)
# --include=dev    : we set NODE_ENV=production above, but vite + tsup are in
#                    devDependencies. Without --include=dev, npm ci skips
#                    them, and `npm run build` fails with "vite: not found"
#                    (seen on pod 21dvf4843sc3kf).
# ----------------------------------------------------------------------------
echo "step-3-build" > /workspace/bootstrap.status
log "STEP 3/5: npm ci (including devDependencies for build) + build"
npm ci --ignore-scripts --include=dev --no-audit --no-fund
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

# Run node in the foreground. If it dies, fall through to `sleep infinity`
# so the container stays up for SSH-based debugging instead of
# restart-looping and losing state. We intentionally do NOT `exec` node —
# we want the bash wrapper alive as a safety net.
echo "running" > /workspace/bootstrap.status
node dist/server/index.js
RC=$?
echo "node-exited-${RC}" > /workspace/bootstrap.status
log "node exited with code ${RC}; holding container open for SSH debugging"
exec sleep infinity
