import { execFileSync } from "node:child_process";

type GateMode = "commit" | "push" | "publish";
type PublishStatus = {
  ahead: number;
  behind: number;
};

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

function readLines(args: string[]): string[] {
  const output = runGit(args);
  return output ? output.split("\n") : [];
}

function fail(message: string): never {
  console.error(`\n[git-gate] ${message}`);
  process.exit(1);
}

function printSection(title: string, lines: string[]): void {
  console.log(`\n${title}`);
  if (lines.length === 0) {
    console.log("(none)");
    return;
  }

  for (const line of lines) {
    console.log(line);
  }
}

function readPublishStatus(upstream: string): PublishStatus {
  const output = runGit(["rev-list", "--left-right", "--count", `${upstream}...HEAD`]);
  const [behindRaw = "0", aheadRaw = "0"] = output.split(/\s+/);

  return {
    ahead: Number(aheadRaw),
    behind: Number(behindRaw),
  };
}

const mode = process.argv[2] as GateMode | undefined;

if (mode !== "commit" && mode !== "push" && mode !== "publish") {
  fail("Usage: npm run gate:commit, npm run gate:push, or npm run gate:publish");
}

const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);

if (branch === "HEAD") {
  fail("Detached HEAD is not allowed for story work. Check out a story branch first.");
}

if (branch === "main" || branch === "production") {
  fail(
    `Direct ${mode} work on '${branch}' is blocked. Create or switch to a story branch first, for example: git switch -c chore/<story-id>-<summary>`,
  );
}

runGit(["diff", "--check"]);

const status = readLines(["status", "--short"]);
const recentLog = readLines(["log", "--oneline", "--decorate", "-n", "5"]);
const upstream = runGit(
  ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
  { allowFailure: true },
);

printSection("git status --short", status);
printSection("git log --oneline --decorate -n 5", recentLog);

if (upstream) {
  const publishStatus = readPublishStatus(upstream);
  console.log(
    `\nUpstream: ${upstream} (ahead ${publishStatus.ahead}, behind ${publishStatus.behind})`,
  );
} else {
  console.log("\nUpstream: (none configured yet)");
}

if (mode === "push") {
  if (!upstream) {
    console.log(`First push required: git push -u origin ${branch}`);
  }

  console.log(
    "Reminder: refresh remotes with git fetch --all --prune if this branch may have drifted.",
  );
}

if (mode === "publish") {
  if (status.length > 0) {
    fail(
      "Publish gate requires a clean worktree. Commit or discard local changes before claiming the branch is published.",
    );
  }

  if (!upstream) {
    fail(`Branch '${branch}' has no upstream yet. Publish it with: git push -u origin ${branch}`);
  }

  const publishStatus = readPublishStatus(upstream);

  if (publishStatus.ahead !== 0 || publishStatus.behind !== 0) {
    fail(
      `Branch '${branch}' is not fully published. Local branch is ahead ${publishStatus.ahead} / behind ${publishStatus.behind} relative to '${upstream}'. Push or sync before handoff.`,
    );
  }

  const head = runGit(["rev-parse", "HEAD"]);
  const upstreamHead = runGit(["rev-parse", "@{u}"]);

  if (head !== upstreamHead) {
    fail(
      `Branch '${branch}' is not aligned with '${upstream}'. Local HEAD ${head} does not match upstream ${upstreamHead}.`,
    );
  }

  console.log(
    "\nPublish check: local HEAD matches upstream. It is valid to claim this branch is on GitHub.",
  );
}

console.log(`\n[git-gate] ${mode} gate passed for branch '${branch}'.`);

console.log(
  "\nNext: confirm the staged diff is story-scoped, update the packet/backlog docs, and run the smallest required validation set.",
);
