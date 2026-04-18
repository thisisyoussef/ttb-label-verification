export const STITCH_FLOW_MODES = [
  "direct",
  "automated",
  "manual",
] as const;

export type StitchFlowMode = (typeof STITCH_FLOW_MODES)[number];

const LEGACY_STITCH_FLOW_MODE_ALIASES = {
  "claude-direct": "direct",
} as const;

export const DEFAULT_STITCH_FLOW_MODE: StitchFlowMode = "direct";

export function getStitchFlowMode(
  rawValue = process.env.STITCH_FLOW_MODE
): StitchFlowMode {
  const normalized = rawValue?.trim().toLowerCase();

  if (!normalized) {
    return DEFAULT_STITCH_FLOW_MODE;
  }

  const aliased =
    LEGACY_STITCH_FLOW_MODE_ALIASES[
      normalized as keyof typeof LEGACY_STITCH_FLOW_MODE_ALIASES
    ];

  if (aliased) {
    return aliased;
  }

  if (STITCH_FLOW_MODES.includes(normalized as StitchFlowMode)) {
    return normalized as StitchFlowMode;
  }

  throw new Error(
    `Unsupported STITCH_FLOW_MODE '${rawValue}'. Expected one of: ${STITCH_FLOW_MODES.join(
      ", "
    )}.`
  );
}

export function requireAutomatedStitchFlow(
  flowMode = getStitchFlowMode()
): void {
  if (flowMode === "automated") {
    return;
  }

  if (flowMode === "direct") {
    throw new Error(
      "Stitch automated flow is disabled because STITCH_FLOW_MODE is 'direct'. Switch it to 'automated' to run Stitch generation, or leave it as 'direct' for direct UI work."
    );
  }

  throw new Error(
    "Stitch automated flow is disabled because STITCH_FLOW_MODE is 'manual'. Switch it to 'automated' to run Stitch generation, or keep 'manual' for an explicit Comet fallback."
  );
}
