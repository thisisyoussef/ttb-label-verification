import { describe, expect, it } from "vitest";

import {
  closeActiveBranchEntry,
  findActiveBranchEntry,
  upsertActiveBranchEntry,
} from "./branch-tracker";

const INITIAL_TRACKER = `# Branch Tracker

Last updated: 2026-04-15

## Active branches

<!-- ACTIVE_BRANCHES:START -->
| Branch | Story | Lane | Status | Description | PR | Opened | Updated | Base | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
<!-- ACTIVE_BRANCHES:END -->

## Closed branches

<!-- CLOSED_BRANCHES:START -->
| Branch | Story | Lane | Final status | Description | Closed | Notes |
| --- | --- | --- | --- | --- | --- | --- |
<!-- CLOSED_BRANCHES:END -->
`;

describe("branch tracker helpers", () => {
  it("upserts an active branch row without duplicating the branch", () => {
    const first = upsertActiveBranchEntry(INITIAL_TRACKER, {
      branch: "chore/TTB-WF-003-branch-tracker",
      storyId: "TTB-WF-003",
      lane: "chore",
      status: "draft-local",
      description: "add branch tracker workflow",
      pr: "-",
      opened: "2026-04-15",
      updated: "2026-04-15",
      base: "main",
      notes: "isolated worktree",
    });

    const second = upsertActiveBranchEntry(first, {
      branch: "chore/TTB-WF-003-branch-tracker",
      storyId: "TTB-WF-003",
      lane: "chore",
      status: "draft-pr",
      description: "add branch tracker workflow",
      pr: "#123",
      opened: "2026-04-15",
      updated: "2026-04-16",
      base: "main",
      notes: "opened draft PR",
    });

    expect(second.match(/chore\/TTB-WF-003-branch-tracker/g)).toHaveLength(1);
    expect(findActiveBranchEntry(second, "chore/TTB-WF-003-branch-tracker")).toEqual(
      expect.objectContaining({
        status: "draft-pr",
        pr: "#123",
        updated: "2026-04-16",
      }),
    );
  });

  it("moves a closed branch into the closed-history table", () => {
    const withActive = upsertActiveBranchEntry(INITIAL_TRACKER, {
      branch: "chore/TTB-WF-003-branch-tracker",
      storyId: "TTB-WF-003",
      lane: "chore",
      status: "ready-pr",
      description: "add branch tracker workflow",
      pr: "#123",
      opened: "2026-04-15",
      updated: "2026-04-16",
      base: "main",
      notes: "ready to merge",
    });

    const closed = closeActiveBranchEntry(withActive, "chore/TTB-WF-003-branch-tracker", {
      finalStatus: "merged",
      closed: "2026-04-17",
      notes: "merged via PR #123",
    });

    expect(findActiveBranchEntry(closed, "chore/TTB-WF-003-branch-tracker")).toBeUndefined();
    expect(closed).toContain("| `chore/TTB-WF-003-branch-tracker` | `TTB-WF-003` | `chore` | `merged` | add branch tracker workflow | `2026-04-17` | merged via PR #123 |");
  });
});
