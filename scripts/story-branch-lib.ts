import path from "node:path";

export function isWithinPath(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveWorktreePath(repoRoot: string, requestedPath: string): string {
  const resolvedPath = path.resolve(requestedPath);

  if (isWithinPath(repoRoot, resolvedPath)) {
    throw new Error(
      `Linked worktrees must live outside the repo root. Use a sibling path such as '../${path.basename(repoRoot)}-<name>' instead of '${requestedPath}'.`,
    );
  }

  return resolvedPath;
}

export function resolveDefaultBase({
  requestedBase,
  currentBranch,
  availableRefs,
}: {
  requestedBase?: string;
  currentBranch: string;
  availableRefs: string[];
}): string {
  if (requestedBase?.trim()) {
    return requestedBase.trim();
  }

  if (availableRefs.includes("origin/main")) {
    return "origin/main";
  }

  if (availableRefs.includes("main")) {
    return "main";
  }

  return currentBranch;
}

export function buildOpenNotes({
  requestedNotes,
  base,
  worktreePath,
}: {
  requestedNotes?: string;
  base: string;
  worktreePath?: string;
}): string {
  if (requestedNotes?.trim()) {
    return requestedNotes.trim();
  }

  if (worktreePath) {
    return `linked worktree: ${worktreePath}`;
  }

  return `opened from ${base}`;
}
