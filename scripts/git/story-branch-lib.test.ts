import { describe, expect, it } from "vitest";

import {
  buildOpenNotes,
  isWithinPath,
  resolveDefaultBase,
  resolveWorktreePath,
} from "./story-branch-lib";

describe("story branch worktree helpers", () => {
  it("detects paths inside the repo root", () => {
    expect(isWithinPath("/repo", "/repo")).toBe(true);
    expect(isWithinPath("/repo", "/repo/.claude/worktrees/demo")).toBe(true);
    expect(isWithinPath("/repo", "/repo-sibling")).toBe(false);
  });

  it("rejects nested worktree paths inside the repo root", () => {
    expect(() => resolveWorktreePath("/repo", "/repo/.claude/worktrees/demo")).toThrow(
      "outside the repo root",
    );
  });

  it("accepts sibling worktree paths", () => {
    expect(resolveWorktreePath("/repo", "/repo-wf-003")).toBe("/repo-wf-003");
  });

  it("prefers origin/main as the default base when available", () => {
    expect(
      resolveDefaultBase({
        currentBranch: "claude/TTB-000-current-story",
        availableRefs: ["origin/main", "main"],
      }),
    ).toBe("origin/main");

    expect(
      resolveDefaultBase({
        currentBranch: "claude/TTB-000-current-story",
        availableRefs: ["main"],
      }),
    ).toBe("main");

    expect(
      resolveDefaultBase({
        currentBranch: "claude/TTB-000-current-story",
        availableRefs: [],
      }),
    ).toBe("claude/TTB-000-current-story");
  });

  it("keeps explicit notes and otherwise derives notes from the worktree/base", () => {
    expect(
      buildOpenNotes({
        requestedNotes: "custom note",
        base: "origin/main",
        worktreePath: "/repo-wf-003",
      }),
    ).toBe("custom note");

    expect(
      buildOpenNotes({
        base: "origin/main",
        worktreePath: "/repo-wf-003",
      }),
    ).toBe("linked worktree: /repo-wf-003");

    expect(
      buildOpenNotes({
        base: "origin/main",
      }),
    ).toBe("opened from origin/main");
  });
});
