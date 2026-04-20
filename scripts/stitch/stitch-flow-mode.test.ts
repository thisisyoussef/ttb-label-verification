import { describe, expect, it } from "vitest";

import {
  DEFAULT_STITCH_FLOW_MODE,
  getStitchFlowMode,
  requireAutomatedStitchFlow,
} from "./stitch-flow-mode";

describe("stitch flow mode", () => {
  it("defaults to the direct flow when unset", () => {
    expect(getStitchFlowMode(undefined)).toBe(DEFAULT_STITCH_FLOW_MODE);
  });

  it("normalizes supported values", () => {
    expect(getStitchFlowMode("  AUTOMATED  ")).toBe("automated");
    expect(getStitchFlowMode("manual")).toBe("manual");
    expect(getStitchFlowMode("claude-direct")).toBe("direct");
  });

  it("rejects unsupported values", () => {
    expect(() => getStitchFlowMode("stitchless")).toThrow(
      "Unsupported STITCH_FLOW_MODE"
    );
  });

  it("allows the automated Stitch runner only in automated mode", () => {
    expect(() => requireAutomatedStitchFlow("automated")).not.toThrow();
  });

  it("explains the direct mode when Stitch generation is blocked", () => {
    expect(() => requireAutomatedStitchFlow("direct")).toThrow(
      "direct UI work"
    );
  });

  it("explains the manual Comet fallback when Stitch generation is blocked", () => {
    expect(() => requireAutomatedStitchFlow("manual")).toThrow(
      "explicit Comet fallback"
    );
  });
});
