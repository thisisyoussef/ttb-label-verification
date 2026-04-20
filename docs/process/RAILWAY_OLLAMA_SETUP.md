# Railway + Ollama Deployment Guide

This document explains how to deploy the TTB label verification service to Railway, with three operating modes: **cloud**, **hybrid**, and **fully local**.

## Deployment modes at a glance

| Mode | Inference calls | Railway plan | RAM needed | Cost/month | Latency avg | Data egress |
|------|-----------------|--------------|------------|------------|-------------|-------------|
| **Cloud** (default) | Gemini API + OpenAI API | Hobby or Pro | ~512MB | $5-20 (hosting) + API usage | ~5.9s | Every label image leaves the datacenter |
| **Hybrid** | Cloud primary, local fallback | Pro | ~6-8GB | $20-50 | 5.9s cloud, ~15-30s local fallback | Same as cloud |
| **Fully local** | Ollama Qwen2.5-VL + Qwen2.5 judgment | Pro (24GB RAM minimum) | ~8-10GB | $50-150 | ~15-45s on CPU (no GPU on Railway) | None |

**Recommendation**: For production, use **Cloud mode** (current default). Railway does not offer GPU instances, and running a VLM on CPU adds 10-40s of per-label latency. Go fully local only when data residency, compliance, or cost-per-inference pushes it over the threshold.

## 1. Cloud mode (current default)

This is what `railway.toml` + `nixpacks.toml` ship with today.

### Setup

```bash
# Set via Railway dashboard or CLI:
railway variables set --project $RAILWAY_PROJECT_ID --environment staging \
  GEMINI_API_KEY=<your-gemini-key>         # required for VLM extraction
  OPENAI_API_KEY=<your-openai-key>         # optional fallback
  NODE_ENV=production
  OCR_PREPASS=enabled
  REGION_DETECTION=disabled
  LLM_JUDGMENT=enabled                     # enables Gemini Flash judgment layer
  # OPENAI_STORE=false                     # recommended: don't persist to OpenAI
```

### Deploy

```bash
# Staging (triggered by push to main via GitHub Actions)
git push origin main

# Production (triggered by push to production via GitHub Actions)
git push origin production
```

### Verify

```bash
curl https://ttb-label-verification-staging.up.railway.app/api/health
# Expect: {"ok":true,"store":false}
```

## 2. Hybrid mode (cloud primary, local fallback)

Use this if you want a local fallback when cloud APIs are rate-limited or unavailable, without committing to full local.

### Setup

Same env vars as Cloud mode, plus:

```bash
railway variables set \
  OLLAMA_FALLBACK_ENABLED=true \
  OLLAMA_HOST=http://127.0.0.1:11434
```

### nixpacks.toml addition

```toml
[phases.setup]
aptPkgs = [
  "tesseract-ocr",
  "tesseract-ocr-eng",
  "curl",                # needed to install Ollama
]

# Install Ollama binary during build
[phases.install]
cmds = [
  "curl -fsSL https://ollama.com/install.sh | sh",
  "npm install"
]

[phases.build]
cmds = [
  "ollama serve & sleep 3 && ollama pull qwen2.5vl:3b && ollama pull qwen2.5:1.5b-instruct",
  "npm run build"
]

[start]
cmd = "ollama serve & npm run start"
```

**Caveats:**
- The `ollama pull` during build bakes the models (~4GB) into the image layer — Railway build times will increase significantly (5-15 min).
- At runtime, `ollama serve` must be running in the background before the Node app accepts traffic. The `&` background fork above is a simple approach but doesn't handle ollama process crashes cleanly.
- Better: use `concurrently` or a process manager, or deploy Ollama as a separate Railway service.

## 3. Fully local mode

All inference runs inside your Railway containers. Zero cloud LLM calls. Higher latency, higher RAM, higher hosting cost.

### Two architectural options

#### Option 3a: Ollama in the same container (sidecar process)

Everything runs in one Railway service. Simplest to deploy but couples inference and app lifecycle.

**nixpacks.toml:**

```toml
[phases.setup]
aptPkgs = [
  "tesseract-ocr",
  "tesseract-ocr-eng",
  "curl"
]

[phases.install]
cmds = [
  "curl -fsSL https://ollama.com/install.sh | sh",
  "npm install"
]

[phases.build]
cmds = [
  # Start ollama, pull models, stop it (baked into image)
  "ollama serve > /tmp/ollama-build.log 2>&1 & sleep 5",
  "ollama pull qwen2.5vl:3b",
  "ollama pull qwen2.5:1.5b-instruct",
  "pkill -f 'ollama serve' || true",
  "npm run build"
]

[start]
# Launch ollama + app together. Use concurrently so both start cleanly.
cmd = "npx -y concurrently -n OLLAMA,APP 'ollama serve' 'npm run start'"

[variables]
NODE_ENV = "production"
OCR_PREPASS = "enabled"
REGION_DETECTION = "disabled"
LLM_JUDGMENT = "enabled"

# Local mode switches
AI_PROVIDER = "local"
OLLAMA_HOST = "http://127.0.0.1:11434"
OLLAMA_VISION_MODEL = "qwen2.5vl:3b"
OLLAMA_JUDGMENT_MODEL = "qwen2.5:1.5b-instruct"

# Keep both models resident so judgment calls don't trigger 30s model swap
OLLAMA_KEEP_ALIVE = "30m"
OLLAMA_MAX_LOADED_MODELS = "2"
```

**Railway plan requirement:** Pro with at least 24GB RAM recommended. Qwen2.5-VL-3B needs ~3GB resident, Qwen2.5-1.5B needs ~1GB resident, Node + Tesseract + headroom ~2GB. Without enough RAM, Ollama will swap models and every judgment call costs 30-60s.

#### Option 3b: Dedicated Ollama service (recommended for Pro users)

Run Ollama as its own Railway service. The app service talks to it over Railway's internal network. Models persist across app restarts.

**Create a second Railway service** called `ttb-ollama`:

1. In Railway dashboard: create new service, pick "Custom Dockerfile" or "Empty Service"
2. Use this `Dockerfile`:

```dockerfile
FROM ollama/ollama:latest

# Pre-pull models during image build
RUN ollama serve & \
    sleep 5 && \
    ollama pull qwen2.5vl:3b && \
    ollama pull qwen2.5:1.5b-instruct && \
    pkill -f 'ollama serve'

ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_KEEP_ALIVE=30m
ENV OLLAMA_MAX_LOADED_MODELS=2

EXPOSE 11434
CMD ["ollama", "serve"]
```

3. Set Railway variables on the `ttb-ollama` service:
   - `OLLAMA_HOST=0.0.0.0:11434`
   - `OLLAMA_KEEP_ALIVE=30m`

4. On the `ttb-label-verification` service, point at the Ollama service via Railway's internal DNS:
   - `OLLAMA_HOST=http://ttb-ollama.railway.internal:11434`
   - `AI_PROVIDER=local`
   - `OLLAMA_VISION_MODEL=qwen2.5vl:3b`
   - `OLLAMA_JUDGMENT_MODEL=qwen2.5:1.5b-instruct`

**Advantages over Option 3a:**
- Ollama restarts don't restart the app
- Model cache persists on the Ollama service volume
- Can scale inference independently of app
- Cleaner separation for monitoring/logs

**Disadvantages:**
- Two Railway services (higher baseline cost)
- Internal network adds ~5-20ms latency per request
- Needs a Railway volume to persist the model cache across redeploys

## 4. Optimizing for Railway CPU (no GPU)

Railway does not offer GPU instances on any plan as of 2026-04. All model inference runs on CPU. Expect:

| Model | CPU inference (Railway Pro 8 vCPU) | Apple M-series GPU (Metal) |
|-------|-----------------------------------|---------------------------|
| Qwen2.5-VL-3B (Q4) | 15-45s per image | 3-7s per image |
| Qwen2.5-1.5B (Q4) | 2-8s per judgment | 0.3-1.5s per judgment |

### CPU optimization tips

1. **Use smaller quantization** — Q4_K_M is the default. Q3_K_M shaves ~25% RAM for ~10% accuracy loss. Try it if RAM is tight.

2. **Cap token output** — the extractor's JSON output is bounded by schema, but judgment LLMs may over-explain. Set `OLLAMA_NUM_PREDICT=256` for judgment calls.

3. **Disable thinking/reasoning** — Qwen2.5-VL has no reasoning mode, but Qwen3 derivatives do. Ensure `thinkingBudget=0` equivalent is set for judgment.

4. **Warm the models on container start** — fire a dummy `ollama generate` for each model right after `ollama serve` comes up. First real request won't eat the cold-start penalty.

```bash
# Add to nixpacks.toml [start] cmd:
ollama serve &
sleep 3
# Warm both models
curl -s http://127.0.0.1:11434/api/generate -d '{"model":"qwen2.5vl:3b","prompt":"hi","stream":false,"options":{"num_predict":1}}' > /dev/null
curl -s http://127.0.0.1:11434/api/generate -d '{"model":"qwen2.5:1.5b-instruct","prompt":"hi","stream":false,"options":{"num_predict":1}}' > /dev/null
npm run start
```

5. **Raise `healthcheckTimeout`** in `railway.toml` — Ollama model load on first request can take 30-60s on CPU. Increase production timeout to `180`.

## 5. Cost comparison (monthly estimate, ~1000 labels/day)

| Mode | Compute | API | Total |
|------|---------|-----|-------|
| Cloud | ~$10 (512MB, always-on) | ~$30-60 (Gemini Flash+Lite) | **$40-70** |
| Hybrid | ~$30 (8GB Pro) | ~$30-60 (cloud primary) | **$60-90** |
| Fully local (3a) | ~$80-150 (24GB Pro, high RAM ceiling) | $0 | **$80-150** |
| Fully local (3b) | ~$120-200 (two Pro services) | $0 | **$120-200** |

**Break-even:** fully local only makes sense at ~10,000+ labels/day OR when compliance requires zero data egress.

## 6. Environment variable reference

### Always required

| Variable | Cloud | Hybrid | Local |
|----------|-------|--------|-------|
| `NODE_ENV=production` | ✅ | ✅ | ✅ |
| `OCR_PREPASS=enabled` | ✅ | ✅ | ✅ |
| `REGION_DETECTION=disabled` | ✅ | ✅ | ✅ |

### Cloud / Hybrid specific

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Primary VLM extractor |
| `OPENAI_API_KEY` | Fallback VLM extractor |
| `LLM_JUDGMENT=enabled` | Enables judgment layer (Gemini Flash) |
| `GEMINI_JUDGMENT_MODEL=gemini-2.5-flash-lite` | Override judgment model |

### Local specific

| Variable | Purpose | Default |
|----------|---------|---------|
| `AI_PROVIDER=local` | Flip default mode to local | `cloud` |
| `OLLAMA_HOST` | Ollama endpoint | `http://127.0.0.1:11434` |
| `OLLAMA_VISION_MODEL` | VLM model tag | `qwen2.5vl:3b` |
| `OLLAMA_JUDGMENT_MODEL` | Judgment LLM tag | `qwen2.5:1.5b-instruct` |
| `OLLAMA_KEEP_ALIVE` | How long models stay loaded | `30m` |
| `OLLAMA_MAX_LOADED_MODELS` | Concurrent models | `2` |
| `LLM_JUDGMENT_PROVIDER=ollama` | Force local judgment | auto |

### Hybrid switch

| Variable | Purpose |
|----------|---------|
| `OLLAMA_FALLBACK_ENABLED=true` | Try Ollama if cloud fails |

## 7. Troubleshooting

### "model not found" errors on cold start

Ollama needs to pull the model once. Either pre-pull during build (see Options 3a/3b above) or warm after first `ollama serve`.

### First request takes 60+ seconds

Cold-start model load. Add warming commands to the container startup (section 4, tip 4).

### Out-of-memory (OOM) on 8GB Railway Hobby

Qwen2.5-VL-3B needs ~4GB resident + inference headroom. 8GB is tight. Either upgrade to Pro or stick with Cloud mode.

### Internal network unreachable between services

Railway internal DNS uses `<service-name>.railway.internal`. Make sure the Ollama service has its private IP enabled in the Railway settings.

### Ollama OOM kills the app in Option 3a

The sidecar-in-same-container pattern means if Ollama spikes, Node gets SIGKILL too. Use Option 3b (separate services) for better isolation.

## 8. Testing local mode locally before deploying

```bash
# On your Mac (with Ollama installed locally)
ollama pull qwen2.5vl:3b
ollama pull qwen2.5:1.5b-instruct

# Run the eval with local mode
AI_PROVIDER=local \
  OCR_PREPASS=enabled \
  LLM_JUDGMENT=enabled \
  OLLAMA_KEEP_ALIVE=30m \
  OLLAMA_MAX_LOADED_MODELS=2 \
  NODE_ENV=test \
  npx tsx scripts/evals/run-cola-cloud-batch-fixtures.ts
```

Compare against `evals/results/2026-04-15-TTB-EVAL-001-batch-real-corpus.json` (cloud baseline).

## 9. What the benchmarks say

See `docs/reference/accuracy-research-2026-04-15.md` for the full eval comparison.

Summary on cola-cloud-all (28 real approved labels):
- **Cloud**: 11/28 pass, 0 false rejects, 5.9s avg, 11.8s p95
- **Local on Apple M-series GPU**: 12/28 pass, 0 false rejects, 5.4s avg, 8.5s p95
- **Local on Railway CPU (estimated)**: 12/28 pass, 0 false rejects, 20-40s avg, 60s+ p95

Local matches cloud accuracy. Latency on Railway CPU is the gate — acceptable for batch processing, too slow for interactive review.
