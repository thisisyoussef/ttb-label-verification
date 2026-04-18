export type FileStat = {
  absolutePath: string;
  relativePath: string;
  lines: number;
};

export type SourceSizeBaseline = Record<string, number>;

export function classifySourceSizes({
  fileStats,
  baseline,
  maxLines,
  warningLines,
}: {
  fileStats: FileStat[];
  baseline: SourceSizeBaseline;
  maxLines: number;
  warningLines: number;
}) {
  const warnings = fileStats.filter(
    (stat) => stat.lines >= warningLines && stat.lines <= maxLines,
  );

  const newViolations: FileStat[] = [];
  const baselineRegressions: Array<FileStat & { allowedLines: number }> = [];
  const baselineCandidates = fileStats.filter(
    (stat) => stat.lines <= maxLines && baseline[stat.relativePath] != null,
  );

  for (const stat of fileStats) {
    if (stat.lines <= maxLines) {
      continue;
    }

    const allowedLines = baseline[stat.relativePath];
    if (allowedLines == null) {
      newViolations.push(stat);
      continue;
    }

    if (stat.lines > allowedLines) {
      baselineRegressions.push({
        ...stat,
        allowedLines,
      });
    }
  }

  const staleBaselineEntries = Object.keys(baseline)
    .filter((relativePath) => !fileStats.some((stat) => stat.relativePath === relativePath))
    .sort();

  return {
    warnings,
    newViolations,
    baselineRegressions,
    baselineCandidates,
    staleBaselineEntries,
  };
}
