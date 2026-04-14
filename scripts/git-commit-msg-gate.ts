import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const STORY_BRANCH_PATTERN =
  /^(claude|codex|chore)\/(TTB(?:-[A-Z]+)?-[0-9]+)(?:-.+)?$/;
const EXCEPTION_BRANCH_PATTERN = /^(archive|rewrite)\/.+$/;
const CONVENTIONAL_SUBJECT_PATTERN =
  /^(feat|fix|refactor|chore|docs|test|perf|ci|build|style|revert)(\([^)]+\))?: .+$/;

function runGit(args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const details =
      typeof error === "object" && error !== null
        ? [Reflect.get(error, "stderr"), Reflect.get(error, "stdout")]
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .find(Boolean)
        : "";

    fail(`git ${args.join(" ")} failed.${details ? `\n${details}` : ""}`);
  }
}

function fail(message: string): never {
  console.error(`\n[commit-msg-gate] ${message}`);
  process.exit(1);
}

const messageFile = process.argv[2];

if (!messageFile) {
  fail("Usage: npm run gate:commit-msg -- <path-to-commit-message-file>");
}

const rawMessage = readFileSync(messageFile, "utf8");
const subject = rawMessage.split(/\r?\n/, 1)[0]?.trim() ?? "";

if (!subject) {
  fail("Commit subject must not be empty.");
}

if (!CONVENTIONAL_SUBJECT_PATTERN.test(subject)) {
  fail(
    "Commit subject must use conventional-commit format, for example: feat(TTB-206): add provider registry",
  );
}

const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);

if (EXCEPTION_BRANCH_PATTERN.test(branch)) {
  process.exit(0);
}

const storyBranch = STORY_BRANCH_PATTERN.exec(branch);

if (!storyBranch) {
  fail(
    `Branch '${branch}' is not a valid story branch. Use claude/<story-id>-<summary>, codex/<story-id>-<summary>, or chore/<story-id>-<summary>.`,
  );
}

const storyId = storyBranch[2];

if (!subject.includes(storyId)) {
  fail(`Commit subject must include the branch story id '${storyId}'.`);
}
