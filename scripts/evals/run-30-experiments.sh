#!/bin/bash
# Run 30+ experiments with proper process isolation.
# Each experiment spawns a fresh Node process.

source ~/.nvm/nvm.sh && nvm use 20 2>/dev/null

RESULTS_DIR="evals/experiments"
mkdir -p "$RESULTS_DIR"

# Capture experiment results
declare -a NAMES
declare -a APPROVES
declare -a REVIEWS
declare -a REJECTS
declare -a ERRORS
declare -a AVG_LATENCIES

run_experiment() {
  local name="$1"
  local desc="$2"
  shift 2
  local env_vars="$@"

  echo ""
  echo "============================================================"
  echo "[Exp] $name: $desc"
  echo "============================================================"

  # Run fast-eval with env vars, capture output
  local output
  output=$(eval "$env_vars NODE_ENV=test npx tsx scripts/fast-eval.ts 2>&1")
  local exit_code=$?

  echo "$output" | grep -E "✓|✗|Result|Approved|Rejected|Latency|Per-label"

  # Parse results
  local approved=$(echo "$output" | grep "^Approved:" | grep -o '[0-9]*/' | head -1 | tr -d '/')
  local result_line=$(echo "$output" | grep "^Result:")
  local correct=$(echo "$result_line" | grep -o '[0-9]*/' | head -1 | tr -d '/')
  local rejected=$(echo "$output" | grep -E "actual=reject" | grep -v "negative" | wc -l | tr -d ' ')
  local reviewed=$(echo "$output" | grep -E "actual=review" | wc -l | tr -d ' ')
  local avg_lat=$(echo "$output" | grep "Latency:" | grep -o 'avg=[0-9]*' | grep -o '[0-9]*')

  # Store results
  NAMES+=("$name")
  APPROVES+=("${approved:-0}")
  REVIEWS+=("${reviewed:-0}")
  REJECTS+=("${rejected:-0}")
  AVG_LATENCIES+=("${avg_lat:-0}")

  # Save full output
  echo "$output" > "$RESULTS_DIR/$name.txt"
}

echo "Starting 30-experiment series at $(date)"
echo ""

# --- Group 1: Feature flag combinations (4 experiments) ---
run_experiment "exp01-vlm-only" "VLM only, no OCR" "OCR_PREPASS=disabled REGION_DETECTION=disabled"
run_experiment "exp02-ocr+vlm" "OCR pre-pass + VLM" "OCR_PREPASS=enabled REGION_DETECTION=disabled"
run_experiment "exp03-full-pipe" "Full pipeline (OCR+regions)" "OCR_PREPASS=enabled REGION_DETECTION=enabled"
run_experiment "exp04-regions-no-ocr" "Regions without OCR pre-pass" "OCR_PREPASS=disabled REGION_DETECTION=enabled"

# --- Group 2: Consistency runs - OCR+VLM (5 repeats) ---
for i in {1..5}; do
  run_experiment "exp0$((4+i))-ocr+vlm-r$i" "OCR+VLM repeat $i" "OCR_PREPASS=enabled REGION_DETECTION=disabled"
done

# --- Group 3: Consistency runs - VLM only (5 repeats) ---
for i in {1..5}; do
  run_experiment "exp$((9+i))-vlm-r$i" "VLM-only repeat $i" "OCR_PREPASS=disabled REGION_DETECTION=disabled"
done

# --- Group 4: Consistency runs - Full pipeline (3 repeats) ---
for i in {1..3}; do
  run_experiment "exp$((14+i))-full-r$i" "Full pipeline repeat $i" "OCR_PREPASS=enabled REGION_DETECTION=enabled"
done

# --- Group 5: Provider isolation (4 experiments) ---
run_experiment "exp18-gemini-ocr" "Gemini + OCR" "OCR_PREPASS=enabled REGION_DETECTION=disabled OPENAI_API_KEY="
run_experiment "exp19-gemini-no-ocr" "Gemini only" "OCR_PREPASS=disabled REGION_DETECTION=disabled OPENAI_API_KEY="
run_experiment "exp20-openai-ocr" "OpenAI + OCR" "OCR_PREPASS=enabled REGION_DETECTION=disabled GEMINI_API_KEY="
run_experiment "exp21-openai-no-ocr" "OpenAI only" "OCR_PREPASS=disabled REGION_DETECTION=disabled GEMINI_API_KEY="

# --- Group 6: More OCR+VLM repeats for statistical power (5 more) ---
for i in {6..10}; do
  run_experiment "exp$((16+i))-ocr+vlm-r$i" "OCR+VLM repeat $i" "OCR_PREPASS=enabled REGION_DETECTION=disabled"
done

# --- Group 7: Provider + regions combos (2 experiments) ---
run_experiment "exp27-gemini-regions" "Gemini + regions" "OCR_PREPASS=enabled REGION_DETECTION=enabled OPENAI_API_KEY="
run_experiment "exp28-openai-regions" "OpenAI + regions" "OCR_PREPASS=enabled REGION_DETECTION=enabled GEMINI_API_KEY="

# --- Group 8: Final VLM-only repeats (2 more) ---
run_experiment "exp29-vlm-r6" "VLM-only repeat 6" "OCR_PREPASS=disabled REGION_DETECTION=disabled"
run_experiment "exp30-vlm-r7" "VLM-only repeat 7" "OCR_PREPASS=disabled REGION_DETECTION=disabled"

echo ""
echo "============================================================"
echo "FINAL COMPARISON TABLE (30 experiments)"
echo "============================================================"
printf "%-25s %-8s %-8s %-8s %-10s\n" "Name" "Approve" "Review" "Reject" "AvgMs"
echo "------------------------------------------------------------"
for i in "${!NAMES[@]}"; do
  printf "%-25s %-8s %-8s %-8s %-10s\n" "${NAMES[$i]}" "${APPROVES[$i]}" "${REVIEWS[$i]}" "${REJECTS[$i]}" "${AVG_LATENCIES[$i]}"
done

echo ""
echo "Completed at $(date)"
echo "All results saved to $RESULTS_DIR/"
