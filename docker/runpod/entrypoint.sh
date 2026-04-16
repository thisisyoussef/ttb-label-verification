#!/usr/bin/env bash
#
# RunPod pod entrypoint. Runs Ollama + the Node API as a supervised pair.
#
# Why we don't use `concurrently` or `supervisord`:
#   - The Node app imports Ollama over HTTP, not as a library. So starting
#     Ollama *before* the Node server is a hard dependency — otherwise the
#     first few requests will fail with ECONNREFUSED while the Node app comes
#     up faster than Ollama.
#   - A 30-line bash script gives us enough control (health-gate the Node
#     start on Ollama readiness, fan out SIGTERM to both children, exit with
#     whichever child died first) without pulling in another runtime dep.
#
# Shutdown behavior:
#   - SIGTERM / SIGINT (RunPod sends SIGTERM on pod stop) triggers a graceful
#     shutdown: kill both children, wait for them, then exit.
#   - If either child exits unexpectedly, we propagate the exit code so
#     RunPod's restart policy (if configured on the template) can kick in.

set -eo pipefail

OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
OLLAMA_READY_URL="${OLLAMA_HOST%/}/api/tags"
OLLAMA_READY_TIMEOUT_SECONDS="${OLLAMA_READY_TIMEOUT_SECONDS:-120}"
APP_PORT="${PORT:-8787}"
APP_DIR="${APP_DIR:-/workspace/app}"

log() {
  # Timestamped stderr so RunPod's log UI shows entries in order.
  printf '[ttb-entrypoint %s] %s\n' "$(date -u +%FT%TZ)" "$*" >&2
}

###############################################################################
# 1. Start Ollama in the background.
#
# OLLAMA_HOST inside ollama serve itself defaults to 127.0.0.1:11434, which is
# what the Node app uses. We leave it alone. If the user wants to expose
# Ollama on the RunPod proxy directly they can override OLLAMA_LISTEN_HOST via
# pod env to "0.0.0.0:11434" and also add 11434 to the pod's exposed ports.
###############################################################################
log "starting ollama serve"
ollama serve > /tmp/ollama.log 2>&1 &
OLLAMA_PID=$!

###############################################################################
# 2. Wait for Ollama to be healthy before starting the Node app.
###############################################################################
log "waiting for ollama at ${OLLAMA_READY_URL} (timeout ${OLLAMA_READY_TIMEOUT_SECONDS}s)"
SECONDS_WAITED=0
until curl -sf "${OLLAMA_READY_URL}" >/dev/null 2>&1; do
  if [ "${SECONDS_WAITED}" -ge "${OLLAMA_READY_TIMEOUT_SECONDS}" ]; then
    log "ollama did not become ready in ${OLLAMA_READY_TIMEOUT_SECONDS}s"
    log "--- tail of /tmp/ollama.log ---"
    tail -n 50 /tmp/ollama.log >&2 || true
    kill "${OLLAMA_PID}" 2>/dev/null || true
    exit 1
  fi
  sleep 2
  SECONDS_WAITED=$((SECONDS_WAITED + 2))
done
log "ollama is ready after ${SECONDS_WAITED}s"

# Optional sanity check: make sure the two models we expect are present.
# If they are missing (e.g. someone mounted an empty volume over /root/.ollama)
# we pull them here. This is the cold-start fallback path.
ensure_model() {
  local model="$1"
  if ! ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -qx "${model}"; then
    log "model ${model} not found, pulling (this may take several minutes)"
    ollama pull "${model}"
  else
    log "model ${model} already present"
  fi
}
ensure_model "${OLLAMA_VISION_MODEL:-qwen2.5vl:3b}"
ensure_model "${OLLAMA_JUDGMENT_MODEL:-qwen2.5:1.5b-instruct}"

###############################################################################
# 3. Start the Node API.
###############################################################################
log "starting node api on port ${APP_PORT}"
cd "${APP_DIR}"
node dist/server/index.js &
APP_PID=$!

###############################################################################
# 4. Trap signals and wait for whichever child exits first.
###############################################################################
terminate() {
  log "received termination signal, shutting down"
  kill -TERM "${APP_PID}" 2>/dev/null || true
  kill -TERM "${OLLAMA_PID}" 2>/dev/null || true
  wait "${APP_PID}" 2>/dev/null || true
  wait "${OLLAMA_PID}" 2>/dev/null || true
  exit 0
}
trap terminate SIGTERM SIGINT

# `wait -n` returns as soon as any child exits. We then propagate its exit code
# so RunPod (or docker / compose locally) can decide whether to restart.
set +e
wait -n
EXIT_CODE=$?
log "a child process exited with code ${EXIT_CODE}; tearing down"
kill -TERM "${APP_PID}" 2>/dev/null || true
kill -TERM "${OLLAMA_PID}" 2>/dev/null || true
wait "${APP_PID}" 2>/dev/null || true
wait "${OLLAMA_PID}" 2>/dev/null || true
exit "${EXIT_CODE}"
