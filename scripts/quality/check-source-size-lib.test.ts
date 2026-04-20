import { describe, expect, it } from "vitest";

import { classifySourceSizes, type FileStat } from "./check-source-size-lib";

function stat(relativePath: string, lines: number): FileStat {
  return {
    absolutePath: `/repo/${relativePath}`,
    relativePath,
    lines,
  };
}

describe("classifySourceSizes", () => {
  it("allows an inherited oversized file to stay at its checked-in baseline", () => {
    const result = classifySourceSizes({
      fileStats: [stat("src/server/legacy.ts", 540)],
      baseline: { "src/server/legacy.ts": 540 },
      maxLines: 500,
      warningLines: 350,
    });

    expect(result.newViolations).toEqual([]);
    expect(result.baselineRegressions).toEqual([]);
  });

  it("fails when a baseline-waived file grows beyond its allowed count", () => {
    const result = classifySourceSizes({
      fileStats: [stat("src/server/legacy.ts", 541)],
      baseline: { "src/server/legacy.ts": 540 },
      maxLines: 500,
      warningLines: 350,
    });

    expect(result.baselineRegressions).toEqual([
      expect.objectContaining({
        relativePath: "src/server/legacy.ts",
        lines: 541,
        allowedLines: 540,
      }),
    ]);
  });

  it("fails for a new oversized file without a baseline waiver", () => {
    const result = classifySourceSizes({
      fileStats: [stat("src/server/new-big-file.ts", 510)],
      baseline: {},
      maxLines: 500,
      warningLines: 350,
    });

    expect(result.newViolations).toEqual([
      expect.objectContaining({
        relativePath: "src/server/new-big-file.ts",
        lines: 510,
      }),
    ]);
  });

  it("tracks baseline candidates that dropped back under the hard cap", () => {
    const result = classifySourceSizes({
      fileStats: [stat("src/server/legacy.ts", 499)],
      baseline: { "src/server/legacy.ts": 540 },
      maxLines: 500,
      warningLines: 350,
    });

    expect(result.baselineCandidates).toEqual([
      expect.objectContaining({
        relativePath: "src/server/legacy.ts",
        lines: 499,
      }),
    ]);
  });
});
