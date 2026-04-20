import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  classifySourceSizes,
  type FileStat,
  type SourceSizeBaseline,
} from "./check-source-size-lib.js";

const MAX_LINES = 500;
const WARNING_LINES = 350;
const ROOT = process.cwd();
const BASELINE_PATH = path.resolve(ROOT, "scripts/quality/source-size-baseline.json");
const TARGETS = [
  "src",
  "scripts",
  "vite.config.ts",
  "eval.vitest.config.ts",
  "postcss.config.js",
  "tailwind.config.js",
];
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js"]);

function collectTargetFiles(targetPath: string): string[] {
  const absolutePath = path.resolve(ROOT, targetPath);
  const stats = statSync(absolutePath, { throwIfNoEntry: false });

  if (!stats) {
    return [];
  }

  if (stats.isFile()) {
    return CODE_EXTENSIONS.has(path.extname(absolutePath)) ? [absolutePath] : [];
  }

  return walkDirectory(absolutePath);
}

function walkDirectory(directoryPath: string): string[] {
  return readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return walkDirectory(absolutePath);
    }

    return CODE_EXTENSIONS.has(path.extname(entry.name)) ? [absolutePath] : [];
  });
}

function countLines(absolutePath: string): FileStat {
  const contents = readFileSync(absolutePath, "utf8");
  const lines = contents === "" ? 0 : contents.split(/\r?\n/).length;

  return {
    absolutePath,
    relativePath: path.relative(ROOT, absolutePath),
    lines,
  };
}

function formatStats(title: string, stats: FileStat[]) {
  if (stats.length === 0) {
    return;
  }

  console.log(`\n${title}`);
  for (const stat of stats) {
    console.log(`${String(stat.lines).padStart(4, " ")}  ${stat.relativePath}`);
  }
}

function formatBaselineRegressions(
  title: string,
  stats: Array<FileStat & { allowedLines: number }>,
) {
  if (stats.length === 0) {
    return;
  }

  console.log(`\n${title}`);
  for (const stat of stats) {
    console.log(
      `${String(stat.lines).padStart(4, " ")}  ${stat.relativePath} (baseline ${stat.allowedLines})`,
    );
  }
}

function readBaseline(): SourceSizeBaseline {
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as SourceSizeBaseline;
}

const seenPaths = new Set<string>();
const fileStats = TARGETS.flatMap(collectTargetFiles)
  .filter((absolutePath) => {
    if (seenPaths.has(absolutePath)) {
      return false;
    }

    seenPaths.add(absolutePath);
    return true;
  })
  .map(countLines)
  .sort((left, right) => right.lines - left.lines);

const baseline = readBaseline();
const {
  warnings,
  newViolations,
  baselineRegressions,
  baselineCandidates,
  staleBaselineEntries,
} = classifySourceSizes({
  fileStats,
  baseline,
  maxLines: MAX_LINES,
  warningLines: WARNING_LINES,
});

formatStats(`[source-size] Near the cap (>= ${WARNING_LINES} lines)`, warnings);
formatStats(
  `[source-size] Back under the cap; baseline entry can be removed`,
  baselineCandidates,
);

if (staleBaselineEntries.length > 0) {
  console.log(`\n[source-size] Stale baseline entries`);
  for (const relativePath of staleBaselineEntries) {
    console.log(`   - ${relativePath}`);
  }
}

if (newViolations.length > 0 || baselineRegressions.length > 0) {
  formatStats(`[source-size] New violations (> ${MAX_LINES} lines)`, newViolations);
  formatBaselineRegressions(
    `[source-size] Baseline regressions (grew beyond checked-in allowance)`,
    baselineRegressions,
  );
  console.error(
    `\n[source-size] Source files must stay at or below ${MAX_LINES} lines unless they are explicitly frozen in ${path.relative(
      ROOT,
      BASELINE_PATH,
    )}. New violations and baseline regressions are blocked.`,
  );
  process.exit(1);
}

console.log(
  `\n[source-size] Checked ${String(fileStats.length)} source/tooling files. No new violations or baseline regressions over ${MAX_LINES} lines.`,
);
