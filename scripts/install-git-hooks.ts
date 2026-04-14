import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

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

    throw new Error(`git ${args.join(" ")} failed.${details ? `\n${details}` : ""}`);
  }
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"], { allowFailure: true });

if (!repoRoot) {
  console.log("[hooks] Skipping install because this directory is not inside a git repo.");
  process.exit(0);
}

const hookFiles = ["pre-commit", "pre-push", "commit-msg"];

for (const hookFile of hookFiles) {
  const hookPath = join(repoRoot, ".githooks", hookFile);

  if (!existsSync(hookPath)) {
    throw new Error(`[hooks] Missing required hook file: ${hookPath}`);
  }

  chmodSync(hookPath, 0o755);
}

const currentHooksPath = runGit(["config", "--local", "--get", "core.hooksPath"], {
  allowFailure: true,
});

if (currentHooksPath !== ".githooks") {
  runGit(["config", "--local", "core.hooksPath", ".githooks"]);
}

console.log("[hooks] Repo-managed git hooks are active via core.hooksPath=.githooks");
