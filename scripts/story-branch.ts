import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  buildBranchName,
  closeActiveBranchEntry,
  findActiveBranchEntry,
  isPlaceholderDescription,
  upsertActiveBranchEntry,
  type ActiveBranchStatus,
  type BranchLane,
  type ClosedBranchStatus,
} from "./branch-tracker.js";
import { bootstrapLocalEnv } from "./bootstrap-local-env.js";
import {
  buildOpenNotes,
  resolveDefaultBase,
  resolveWorktreePath,
} from "./story-branch-lib.js";

const TRACKER_RELATIVE_PATH = path.join("docs", "process", "BRANCH_TRACKER.md");

function fail(message: string): never {
  console.error(`\n[story-branch] ${message}`);
  process.exit(1);
}

function runGit(args: string[], options?: { allowFailure?: boolean }): string {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (options?.allowFailure) {
      return "";
    }

    const details =
      typeof error === "object" && error !== null
        ? [Reflect.get(error, "stderr"), Reflect.get(error, "stdout")]
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .find(Boolean)
        : "";

    fail(`git ${args.join(" ")} failed.${details ? `\n${details}` : ""}`);
  }
}

function getRepoRoot(): string {
  return runGit(["rev-parse", "--show-toplevel"]);
}

function getTrackerPath(repoRoot: string): string {
  return path.resolve(repoRoot, TRACKER_RELATIVE_PATH);
}

function refExists(ref: string): boolean {
  return Boolean(runGit(["rev-parse", "--verify", ref], { allowFailure: true }));
}

function readTracker(trackerPath: string): string {
  try {
    return fs.readFileSync(trackerPath, "utf8");
  } catch (error) {
    fail(`Could not read ${trackerPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function writeTracker(trackerPath: string, content: string): void {
  fs.writeFileSync(trackerPath, content);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv: string[]): { command: string; flags: Record<string, string> } {
  const [command = "", ...rest] = argv;
  const flags: Record<string, string> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    const value = rest[index + 1];

    if (!key?.startsWith("--") || value == null) {
      fail("Usage: npm run story:branch -- <open|update|close> --flag value ...");
    }

    flags[key.slice(2)] = value;
    index += 1;
  }

  return { command, flags };
}

function assertCleanWorktree(): void {
  if (runGit(["status", "--short"], { allowFailure: true })) {
    fail(
      "Opening a new branch in the current worktree is blocked while it is dirty. Commit, stash, or pass --worktree <path> to create a linked worktree instead.",
    );
  }
}

function openBranch(flags: Record<string, string>): void {
  const lane = flags.lane as BranchLane | undefined;
  const storyId = flags.story;
  const summary = flags.summary;
  const description = flags.description?.trim();
  const repoRoot = getRepoRoot();
  const currentBranch = runGit(["branch", "--show-current"]);
  const base = resolveDefaultBase({
    requestedBase: flags.base,
    currentBranch,
    availableRefs: ["origin/main", "main"].filter((ref) => refExists(ref)),
  });
  const requestedWorktree = flags.worktree?.trim();
  let worktreePath: string | undefined;
  let bootstrapWarning = "";
  const status = (flags.status as ActiveBranchStatus | undefined) || "draft-local";

  if (lane !== "claude" && lane !== "codex" && lane !== "chore") {
    fail("open requires --lane claude|codex|chore");
  }

  if (!storyId || !summary || !description) {
    fail("open requires --story, --summary, and --description");
  }

  if (isPlaceholderDescription(description)) {
    fail("Branch description must be real content, not a placeholder.");
  }

  const branch = buildBranchName({ lane, storyId, summary });
  if (runGit(["rev-parse", "--verify", `refs/heads/${branch}`], { allowFailure: true })) {
    fail(`Branch '${branch}' already exists locally.`);
  }

  if (requestedWorktree) {
    try {
      worktreePath = resolveWorktreePath(repoRoot, path.resolve(process.cwd(), requestedWorktree));
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }

    if (fs.existsSync(worktreePath)) {
      fail(`Worktree path '${worktreePath}' already exists. Choose a new sibling path.`);
    }

    runGit(["worktree", "add", "-b", branch, worktreePath, base]);

    try {
      bootstrapLocalEnv(worktreePath);
    } catch (error) {
      bootstrapWarning = `\n[story-branch] Repo-local env bootstrap did not complete in the new worktree: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  } else {
    assertCleanWorktree();
    runGit(["switch", "-c", branch, base]);
  }

  const trackerRoot = worktreePath || repoRoot;
  const trackerPath = getTrackerPath(trackerRoot);
  const tracker = readTracker(trackerPath);
  writeTracker(
    trackerPath,
    upsertActiveBranchEntry(tracker, {
      branch,
      storyId,
      lane,
      status,
      description,
      pr: flags.pr?.trim() || "-",
      opened: today(),
      updated: today(),
      base,
      notes: buildOpenNotes({
        requestedNotes: flags.notes,
        base,
        worktreePath,
      }),
    }),
  );

  console.log(
    `\n[story-branch] Created '${branch}' from '${base}' and updated ${path.relative(
      trackerRoot,
      trackerPath,
    )}.${worktreePath ? `\n[story-branch] New linked worktree: ${worktreePath}` : ""}${bootstrapWarning}`,
  );
}

function updateBranch(flags: Record<string, string>): void {
  const trackerPath = getTrackerPath(getRepoRoot());
  const branch = flags.branch?.trim() || runGit(["branch", "--show-current"]);
  const tracker = readTracker(trackerPath);
  const activeEntry = findActiveBranchEntry(tracker, branch);

  if (!activeEntry) {
    fail(`Branch '${branch}' is not tracked yet. Run the open command first or add the row manually.`);
  }

  const description = flags.description?.trim() || activeEntry.description;
  if (isPlaceholderDescription(description)) {
    fail("Branch description must be real content, not a placeholder.");
  }

  writeTracker(
    trackerPath,
    upsertActiveBranchEntry(tracker, {
      ...activeEntry,
      status: (flags.status as ActiveBranchStatus | undefined) || activeEntry.status,
      description,
      pr: flags.pr?.trim() || activeEntry.pr,
      updated: today(),
      notes: flags.notes?.trim() || activeEntry.notes,
    }),
  );

  console.log(`\n[story-branch] Updated tracker entry for '${branch}'.`);
}

function closeBranch(flags: Record<string, string>): void {
  const trackerPath = getTrackerPath(getRepoRoot());
  const branch = flags.branch?.trim() || runGit(["branch", "--show-current"]);
  const finalStatus = flags["final-status"] as ClosedBranchStatus | undefined;

  if (finalStatus !== "merged" && finalStatus !== "abandoned") {
    fail("close requires --final-status merged|abandoned");
  }

  const tracker = readTracker(trackerPath);
  writeTracker(
    trackerPath,
    closeActiveBranchEntry(tracker, branch, {
      finalStatus,
      closed: today(),
      notes: flags.notes?.trim() || "-",
    }),
  );

  console.log(`\n[story-branch] Closed tracker entry for '${branch}' as '${finalStatus}'.`);
}

const { command, flags } = parseArgs(process.argv.slice(2));

switch (command) {
  case "open":
    openBranch(flags);
    break;
  case "update":
    updateBranch(flags);
    break;
  case "close":
    closeBranch(flags);
    break;
  default:
    fail("Usage: npm run story:branch -- <open|update|close> --flag value ...");
}
