# syntax=docker/dockerfile:1.6
#
# RunPod GPU deployment image for the TTB label verification app.
#
# Why this image exists (vs Railway Nixpacks):
#   - Railway has no GPU. On CPU the VLM (qwen2.5vl:3b) takes 20-40s per label;
#     on an NVIDIA A5000 or better it drops to ~3-5s per label.
#   - RunPod Pods run a single container, so we run Ollama and the Node API
#     together via a supervised entrypoint. The Node app talks to Ollama over
#     127.0.0.1:11434, matching the local-dev contract.
#   - We pre-pull the two Ollama models during the image build so the pod
#     cold start does not pay 2-5 min of model-download latency every time.
#
# Expected layout once deployed:
#   /workspace/app         -> repo artifacts (Node dist, static assets)
#   /workspace/ollama      -> persistent Ollama model cache (on the RunPod
#                             volume if one is attached; otherwise container
#                             disk, which is ephemeral)
#
# Exposed port: 8787 (Express). RunPod's HTTP proxy will surface it at
# https://<pod-id>-8787.proxy.runpod.net .

###############################################################################
# Stage 1: Build the Node bundle on a lightweight Node image.
###############################################################################
FROM node:20-bookworm-slim AS builder

WORKDIR /build

# Install only what is needed for `npm ci` + `vite build` + `tsup`.
# python3 + make + g++ are required by a couple of native deps (e.g. sharp's
# optional fallbacks during install).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 \
      make \
      g++ \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Copy manifest files first so layer caching kicks in when only source changes.
COPY package.json package-lock.json* ./
# Skip the postinstall hooks:install step which tries to install git hooks —
# those are irrelevant inside a container and will fail without a .git dir.
RUN npm ci --ignore-scripts

# Now copy the rest of the repo and build both the client and the server
# bundles. The build outputs:
#   dist/            -> Vite client bundle
#   dist/server/     -> tsup-bundled Node server
COPY . .
RUN npm run build

###############################################################################
# Stage 2: Runtime image with CUDA, Ollama, Tesseract, and the built app.
###############################################################################
#
# We use Ollama's official CUDA image as the base because it already contains
# the NVIDIA libraries, the ollama binary, and the glue to talk to the GPU
# that RunPod injects into the container. Installing Node and Tesseract on top
# keeps the final image small and avoids us maintaining our own CUDA layer.
#
# Pin choice: Ollama 0.7.0 is the minimum version that supports qwen2.5vl
# (the model this app uses for VLM extraction). We pin to a known-good
# version rather than `latest` so rebuilds are reproducible; bump
# deliberately when upgrading models. Newer Ollama releases (0.8.x+) work
# fine too — see https://hub.docker.com/r/ollama/ollama/tags.
FROM ollama/ollama:0.7.0 AS runtime

# Ollama's image is based on Ubuntu. Install Node 20 (for the Express API),
# tesseract (for the OCR pre-pass), and curl (for healthchecks).
# DEBIAN_FRONTEND=noninteractive prevents tzdata from prompting.
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      gnupg \
      tesseract-ocr \
      tesseract-ocr-eng \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/app

# Copy production node_modules + built artifacts from the builder stage.
# We re-run `npm ci --omit=dev` inside the runtime image so we only ship the
# packages the server actually needs at runtime — the Vite/Tailwind toolchain
# is not copied over.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts \
 && npm cache clean --force

# Copy built bundles and anything else the server reads at runtime.
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/evals ./evals
COPY --from=builder /build/src/shared ./src/shared

# Copy the runpod-specific entrypoint that runs `ollama serve` + the Node app.
COPY docker/runpod/entrypoint.sh /usr/local/bin/ttb-entrypoint.sh
RUN chmod +x /usr/local/bin/ttb-entrypoint.sh

###############################################################################
# Pre-pull the Ollama models so the pod is ready to serve on cold start.
#
# This happens at BUILD TIME, during `docker build`, on whatever machine
# builds the image (usually your laptop or CI). The models are then baked into
# a Docker layer, so the pod does not re-download them at launch.
#
# Caveat: this makes the image large (~4-5GB for qwen2.5vl:3b and ~1GB for
# qwen2.5:1.5b-instruct). Registry push/pull times will reflect that. If you
# want a smaller image, remove this block and rely on the entrypoint to pull
# models on first start — at the cost of a 2-5 min cold start each time the
# container disk is wiped.
###############################################################################
ENV OLLAMA_MODELS=/root/.ollama/models \
    OLLAMA_KEEP_ALIVE=30m \
    OLLAMA_MAX_LOADED_MODELS=2

# Run ollama in the background during build, pull the two models, then stop it.
# We explicitly use `sh -c` so we can chain the lifecycle cleanly.
RUN sh -c '\
  set -eux ; \
  ollama serve > /tmp/ollama-build.log 2>&1 & \
  OLLAMA_PID=$! ; \
  # Wait for ollama to come up. 60s should be ample on a build machine. \
  for i in $(seq 1 30) ; do \
    if curl -sf http://127.0.0.1:11434/api/tags >/dev/null ; then break ; fi ; \
    sleep 2 ; \
  done ; \
  ollama pull qwen2.5vl:3b ; \
  ollama pull qwen2.5:1.5b-instruct ; \
  kill $OLLAMA_PID || true ; \
  wait $OLLAMA_PID 2>/dev/null || true ; \
  # Quick sanity check that the blobs are actually on disk. \
  du -sh /root/.ollama/models || true \
'

###############################################################################
# Runtime environment and launch configuration.
###############################################################################

# Local-mode env defaults. They can be overridden by RunPod template or pod env.
ENV NODE_ENV=production \
    PORT=8787 \
    AI_PROVIDER=local \
    OLLAMA_HOST=http://127.0.0.1:11434 \
    OLLAMA_VISION_MODEL=qwen2.5vl:3b \
    OLLAMA_JUDGMENT_MODEL=qwen2.5:1.5b-instruct \
    OCR_PREPASS=enabled \
    REGION_DETECTION=disabled \
    LLM_JUDGMENT=enabled

EXPOSE 8787

# The Ollama image ships with ENTRYPOINT ["/bin/ollama"]. We override both
# entrypoint and cmd so our supervisor script owns the container lifecycle.
ENTRYPOINT ["/usr/local/bin/ttb-entrypoint.sh"]
CMD []
