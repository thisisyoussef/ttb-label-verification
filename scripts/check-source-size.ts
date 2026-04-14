import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const MAX_LINES = 500;
const WARNING_LINES = 350;
const ROOT = process.cwd();
const TARGETS = [
  "src",
  "scripts",
  "vite.config.ts",
  "ls.vitest.config.ts",
  "postcss.config.js",
  "tailwind.config.js",
];
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js"]);

type FileStat = {
  absolutePath: string;
  relativePath: string;
  lines: number;
};

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

const violations = fileStats.filter((stat) => stat.lines > MAX_LINES);
const warnings = fileStats.filter(
  (stat) => stat.lines >= WARNING_LINES && stat.lines <= MAX_LINES,
);

formatStats(`[source-size] Near the cap (>= ${WARNING_LINES} lines)`, warnings);

if (violations.length > 0) {
  formatStats(`[source-size] Violations (> ${MAX_LINES} lines)`, violations);
  console.error(
    `\n[source-size] Source files must stay at or below ${MAX_LINES} lines.`,
  );
  process.exit(1);
}

console.log(
  `\n[source-size] Checked ${String(fileStats.length)} source/tooling files. No violations over ${MAX_LINES} lines.`,
);
