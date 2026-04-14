import { describe, expect, it } from "vitest";

import {
  DEFAULT_STITCH_FLOW_MODE,
  getStitchFlowMode,
  requireAutomatedStitchFlow,
} from "./stitch-flow-mode";

describe("stitch flow mode", () => {
  it("defaults to the Claude-direct flow when unset", () => {
    expect(getStitchFlowMode(undefined)).toBe(DEFAULT_STITCH_FLOW_MODE);
  });

  it("normalizes supported values", () => {
    expect(getStitchFlowMode("  AUTOMATED  ")).toBe("automated");
    expect(getStitchFlowMode("manual")).toBe("manual");
  });

  it("rejects unsupported values", () => {
    expect(() => getStitchFlowMode("stitchless")).toThrow(
      "Unsupported STITCH_FLOW_MODE"
    );
  });

  it("allows the automated Stitch runner only in automated mode", () => {
    expect(() => requireAutomatedStitchFlow("automated")).not.toThrow();
  });

  it("explains the Claude-direct mode when Stitch generation is blocked", () => {
    expect(() => requireAutomatedStitchFlow("claude-direct")).toThrow(
      "develop the UI directly"
    );
  });

  it("explains the manual Comet fallback when Stitch generation is blocked", () => {
    expect(() => requireAutomatedStitchFlow("manual")).toThrow(
      "explicit Comet fallback"
    );
  });
});
