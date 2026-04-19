const ESTIMATED_SECONDS_PER_LABEL = 5;

export function estimateBatchSecondsRemaining(remainingLabels: number) {
  return Math.max(0, remainingLabels) * ESTIMATED_SECONDS_PER_LABEL;
}
