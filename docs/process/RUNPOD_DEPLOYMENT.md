# RunPod GPU Deployment Guide

This document explains how to deploy the TTB label verification service to
[RunPod](https://runpod.io), where it can run the Ollama VLM and judgment
models on real NVIDIA GPU hardware. It is the companion to
`docs/process/RAILWAY_OLLAMA_SETUP.md` — **both deployment targets coexist**;
this one is for workloads where GPU acceleration is required.

**TL;DR**

```bash
# one-time: build + push the image
export DOCKER_REGISTRY=docker.io/YOURUSER
scripts/deploy-runpod.sh --build --push

# launch a pod on the default GPU (RTX A5000, ~$0.16/hr, 24GB VRAM)
scripts/deploy-runpod.sh --launch

# teardown (pods bill per second — stop them when you're done)
scripts/deploy-runpod.sh --teardown <pod-id>
```

## Why RunPod (when to use it vs Railway)

| Question | Railway | RunPod |
|---|---|---|
| GPU available? | No | Yes (NVIDIA) |
| Best default for this app? | Cloud mode (Gemini + OpenAI APIs) | Fully-local Ollama on GPU |
| Cost model | Flat monthly + usage | Per-second GPU + volume |
| Warm start | Always-on | Always-on (Pod) or cold-start (Serverless) |
| Typical per-label latency | 5.9s cloud, 20-40s local CPU | 3-5s local GPU |
| Good for | Production cloud deploys, demos, CI | Local-model eval, data-residency, offline |

**Rule of thumb.** If the label volume is low and cloud API calls are
acceptable, Railway cloud mode is cheaper and simpler. If you need fully-local
inference — for data residency, compliance, or to decouple from external API
cost — RunPod gives you GPU acceleration at ~$0.16/hr, which turns a 30s
local CPU inference into a 3s GPU inference.

## Prerequisites

1. **RunPod account** with a funded balance. `runpodctl user` shows
   `clientBalance` — the image push + a few minutes of A5000 time will cost
   under $1 to validate end-to-end.
2. **`runpodctl` installed and authenticated.** This repo was validated
   against `runpodctl 2.1.9-673143d`.
   ```bash
   brew install runpodctl                    # or see https://docs.runpod.io/runpodctl
   runpodctl doctor                          # paste API key when prompted
   runpodctl user                            # verify balance & account
   ```
3. **Docker** installed locally to build and push the image.
4. **A container registry** RunPod can pull from. Any public Docker Hub repo
   works; private registries are supported via `runpodctl registry`.
5. **About 8-10GB of free disk locally** during image build (the baked-in
   Ollama models push the final image to ~5GB compressed / ~9GB extracted).

## GPU selection

RunPod offers the full NVIDIA stack. For this workload — Qwen2.5-VL-3B
(~6GB VRAM at q4) + Qwen2.5-1.5B-instruct (~2GB VRAM at q4) — you need
**at least 8GB VRAM**, and you benefit from more headroom for KV cache when
serving multiple concurrent requests.

| GPU | VRAM | Approx. $/hr (Community) | Approx. $/hr (Secure) | Verdict |
|---|---|---|---|---|
| **RTX A5000** | **24 GB** | **$0.16** | **$0.27** | **Recommended default.** Best $/VRAM for this workload. Ampere is plenty for a 3B VLM. |
| RTX A4000 | 16 GB | $0.17 | - | Budget alternative. Tight with both models loaded simultaneously; may spill to CPU swap. |
| RTX 4000 Ada | 20 GB | $0.18 | - | Newer architecture at similar price — worth A/B testing against A5000. |
| RTX 4090 | 24 GB | $0.34 | ~$0.49 | Faster than A5000 (~20-30% token/s), but 2× the price. Use if per-request latency matters. |
| L4 | 24 GB | $0.44 | $0.44 | Optimised for inference, datacenter-grade, priced like a 4090 without 4090's raw throughput. Skip unless you need the Secure Cloud policy. |
| L40S | 48 GB | $0.79 | $0.79 | Overkill for a 3B model. Only worth it if you want multi-model or batch. |
| RTX 2000 Ada | 16 GB | $0.23 | $0.23 | Works but the A4000 is cheaper for the same VRAM. |

**Recommendation.** Start on **RTX A5000 Community Cloud** (~$0.16/hr).
If availability is "Low" and you can't get one, fall back to RTX 4000 Ada or
RTX 4090. RTX 3090 (also 24GB / ~$0.22) is a good third choice.

Prices vary: `runpodctl gpu list` shows live availability; pricing is surfaced
in the RunPod console.

### Cost per 1,000 labels

At ~4 seconds per label on an A5000 (VLM ~3s + judgment ~1s), 1,000 labels
takes ~1.1 hours of compute. At $0.16/hr that's **~$0.18 per 1,000 labels**
(plus egress, which is free on RunPod at time of writing). For comparison,
on CPU at 30s/label, 1,000 labels takes ~8.3 hours, so the break-even is at
very low volume — almost anything above a one-off demo pays back the GPU.

## Files in this deployment

```
docker/runpod/
├── Dockerfile        # multi-stage: builder (Node) + runtime (CUDA + Ollama)
└── entrypoint.sh     # supervises `ollama serve` + the Node API

scripts/
└── deploy-runpod.sh  # build / push / launch / teardown wrapper around docker + runpodctl
```

The Dockerfile builds in two stages:

1. **Builder** (`node:20-bookworm-slim`): `npm ci && npm run build`. Produces
   `dist/` (Vite client) and `dist/server/` (tsup Node bundle).
2. **Runtime** (`ollama/ollama:0.4.7`): installs Node 20, Tesseract, copies
   the built app, and **pre-pulls both Ollama models at build time**. The
   models are baked into a Docker layer, so pod cold start avoids a 2-5 min
   `ollama pull` on every launch.

The entrypoint (`entrypoint.sh`) runs `ollama serve` in the background,
health-gates the Node API on Ollama's `/api/tags`, and pipes SIGTERM to both
children for clean shutdown.

## Step-by-step

### 1. Build the image locally

```bash
cd /path/to/ttb-label-verification
scripts/deploy-runpod.sh --build
```

This runs `docker build -f docker/runpod/Dockerfile .` at the repo root.
First build takes 8-15 min depending on your network (~4GB of model pulls).
Subsequent builds reuse the Ollama layer and finish in 2-5 min.

You can test the image locally **only if you have a CUDA-capable NVIDIA GPU**
(Apple M-series won't work — the base image is linux/amd64 + CUDA).
For local iteration on a Mac, keep using `npm run dev` with a laptop Ollama.

### 2. Push to a registry

```bash
export DOCKER_REGISTRY=docker.io/YOURUSER      # or ghcr.io/YOURORG
docker login docker.io                         # if not already
scripts/deploy-runpod.sh --build --push
```

The script tags the local image as `$DOCKER_REGISTRY/ttb-label-verification:<git-sha>`
and pushes it. Push takes 3-8 min on a typical home connection; the Ollama
model blobs are the long pole.

If you're using a private registry, register its auth with RunPod so pod
creation can pull from it:

```bash
runpodctl registry create \
  --name dockerhub-private \
  --username YOURUSER \
  --password YOUR_DOCKER_PAT
# then when launching:
runpodctl pod create ... --registry-auth-id <id>
```

(Currently `deploy-runpod.sh` assumes a public image. If you need private
registry support, add `--registry-auth-id` to the `runpodctl pod create`
call near the bottom of the script.)

### 3. Launch a pod

```bash
# default GPU (RTX A5000)
scripts/deploy-runpod.sh --launch

# override GPU
scripts/deploy-runpod.sh --launch --gpu "NVIDIA GeForce RTX 4090"

# or launch on Secure Cloud (ISO/SOC compliant datacenters, ~2× price)
RUNPOD_CLOUD_TYPE=SECURE scripts/deploy-runpod.sh --launch
```

What the script does:

1. Validates GPU VRAM is sufficient (≥8GB).
2. Calls `runpodctl pod create` with the image, env, and a `8787/http` port
   mapping.
3. Parses the new pod ID.
4. Polls `https://<pod-id>-8787.proxy.runpod.net/api/health` every 10s for
   up to 10 min. The models are baked into the image so typical time to
   healthy is 60-120s.
5. Prints the public URL and the teardown command.

### 4. Verify

```bash
curl https://<pod-id>-8787.proxy.runpod.net/api/health
# expect: {"ok": true, "store": false}
```

Then open `https://<pod-id>-8787.proxy.runpod.net/` in a browser to exercise
the full UI against the GPU-backed local models.

### 5. Teardown

Pods bill per second. **Always stop or delete them when you're done.**

```bash
scripts/deploy-runpod.sh --teardown <pod-id>
# or manually:
runpodctl pod stop <pod-id>       # keeps volume, frees GPU (charged for volume)
runpodctl pod delete <pod-id>     # full cleanup including volume
```

RunPod also auto-stops pods that run out of balance, but do not rely on that
as a safety net. Use `runpodctl billing` to check burn rate.

## Persistent model cache (optional)

By default, each pod has its own ephemeral container disk. If you destroy
the pod and create a new one from a later image, the Ollama model blobs are
repulled from the image — no real problem, but wasteful.

To share model state across pod recreations, create a RunPod **Network
Volume** and mount it at `/root/.ollama`:

```bash
runpodctl network-volume create --name ollama-models --size 50 --data-center-id <dc>
# then at launch:
runpodctl pod create ... --network-volume-id <id> --volume-mount-path /root/.ollama
```

For single-pod usage the network volume is unnecessary and adds $0.10/GB/month
of idle cost.

## Troubleshooting

### Pod stuck "starting", never becomes healthy

Check the logs:

```bash
runpodctl pod get <pod-id> --include-machine
# then open the web console and check the "Logs" tab
```

Common causes:

- **GPU not visible to ollama.** Look for `no NVIDIA driver found` in the
  logs. This usually means you picked a CPU-only pod or the template was
  misconfigured. Recreate with `--compute-type GPU --gpu-count 1`.
- **Image pull failed.** Registry is private or the tag is wrong. Confirm
  the image is public (`docker pull $DOCKER_REGISTRY/ttb-label-verification:<tag>`
  from another machine) or wire up registry auth (see step 2).
- **Model pull on first start took > 120s.** If you removed the in-image
  `ollama pull` step, the entrypoint falls back to pulling models at cold
  start. The default health-check window of 10 min should cover it; if it
  times out, bump `OLLAMA_READY_TIMEOUT_SECONDS` via env.

### 502 from the proxy URL

The RunPod HTTP proxy sits in front of the pod and enforces a Cloudflare-like
100-second request timeout. Long-running single requests (e.g. large batch
pipelines) may hit that wall. Two options:

- Tune the pipeline to chunk requests, which is what the existing UI already
  does.
- Switch to TCP port mapping (`--ports 8787/tcp` instead of `8787/http`). That
  gives you a raw TCP endpoint and a public IP, with no 100s cap. You lose
  the HTTPS wrapping; terminate TLS on the pod if you need it.

### Tesseract errors ("language data not found")

The Dockerfile installs `tesseract-ocr-eng`. If you want additional languages,
extend the apt-get line in `docker/runpod/Dockerfile`.

### Models not loading (out of memory)

With both models resident and `OLLAMA_MAX_LOADED_MODELS=2`, the A5000's 24GB
is more than enough. If you switch to a 16GB card (A4000, RTX 2000 Ada) and
see `out of memory` in the ollama logs:

- Lower `OLLAMA_MAX_LOADED_MODELS=1` (Ollama will swap models on demand;
  adds ~2-3s latency on judgment calls but fits in 16GB).
- Or pick a smaller judgment model via `OLLAMA_JUDGMENT_MODEL`.

### Pod is healthy but the UI shows errors

Check the server logs via the RunPod web console. The most common causes are
env vars that didn't propagate — verify with:

```bash
runpodctl pod get <pod-id>
```

The `env` field should list `AI_PROVIDER=local`, `OLLAMA_HOST=http://127.0.0.1:11434`,
etc.

## Pod vs Serverless (why this repo uses Pods)

RunPod has two primitives:

- **Pods** — long-running GPU VMs, billed per second while running.
  Good for persistent HTTP APIs like this one. Cold-start is "how fast does
  the container come up" (tens of seconds for us, thanks to pre-baked models).
- **Serverless** — scale-to-zero GPU functions, billed per second of actual
  request execution. Good for bursty workloads. Cold-start is "how fast does
  a fresh worker warm up" — typically 10-30s for a multi-GB model.

This repo targets Pods because:

1. The app is a persistent HTTP API with a UI; scale-to-zero adds UX latency.
2. Our traffic pattern (eval runs, demo sessions) is bursty-but-continuous,
   not sparse enough for Serverless to win on cost.
3. Pods give us a single predictable URL for the demo.

If you want to run this as a Serverless endpoint (e.g. for truly
pay-per-label inference), you'd need to split the architecture into
`{UI + orchestrator}` on Railway/Vercel and `{VLM + judgment}` on RunPod
Serverless. That's a larger refactor and not part of this guide.

## Comparison to Railway (decision matrix)

| Scenario | Target | Why |
|---|---|---|
| Production demo with moderate traffic, acceptable to call cloud APIs | Railway, Cloud mode | Simplest, cheapest, no GPU needed |
| Data-residency or compliance requirement (no external AI calls) | RunPod, A5000 | Local inference + GPU for UX |
| Eval runs (hundreds of labels, batch) | RunPod, A5000 or 4090 | 10× throughput vs CPU |
| One-off demo, very low volume | Railway Cloud, stop after demo | No GPU spin-up cost |
| Customer pilot with fluctuating volume | RunPod Pods, stop when idle | Per-second billing matches usage |
| "Will this even work with local models?" experiment | RunPod 1-hour spin-up | ~$0.20 sanity check |

## Future work

- Add `--registry-auth-id` support to `deploy-runpod.sh` for private images.
- Investigate Serverless split (UI on Railway, inference on RunPod Serverless)
  for sparse-traffic customer deployments — would drop idle cost to $0.
- Add `RUNPOD_NETWORK_VOLUME_ID` pass-through for long-lived model caches.
- Add a GitHub Actions workflow that builds + pushes the image on tag, so
  deploy is `git tag vX.Y.Z && push`.
