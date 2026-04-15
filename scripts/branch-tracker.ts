export const STORY_BRANCH_PATTERN =
  /^(claude|codex|chore)\/(TTB(?:-[A-Z]+)?-[0-9]+)(?:-.+)?$/;

const ACTIVE_START = "<!-- ACTIVE_BRANCHES:START -->";
const ACTIVE_END = "<!-- ACTIVE_BRANCHES:END -->";
const CLOSED_START = "<!-- CLOSED_BRANCHES:START -->";
const CLOSED_END = "<!-- CLOSED_BRANCHES:END -->";

export type BranchLane = "claude" | "codex" | "chore";
export type ActiveBranchStatus =
  | "draft-local"
  | "published"
  | "draft-pr"
  | "ready-pr";
export type ClosedBranchStatus = "merged" | "abandoned";

export type ActiveBranchEntry = {
  branch: string;
  storyId: string;
  lane: BranchLane;
  status: ActiveBranchStatus;
  description: string;
  pr: string;
  opened: string;
  updated: string;
  base: string;
  notes: string;
};

export type ClosedBranchEntry = {
  branch: string;
  storyId: string;
  lane: BranchLane;
  finalStatus: ClosedBranchStatus;
  description: string;
  closed: string;
  notes: string;
};

type ParsedTracker = {
  active: ActiveBranchEntry[];
  closed: ClosedBranchEntry[];
};

function sanitizeCell(value: string): string {
  return value.replace(/\|/g, "/").trim();
}

function extractManagedBlock(content: string, start: string, end: string): string {
  const pattern = new RegExp(`${escapeForRegex(start)}\\n([\\s\\S]*?)\\n${escapeForRegex(end)}`);
  const match = content.match(pattern);

  if (!match) {
    throw new Error(`Managed tracker block not found: ${start} .. ${end}`);
  }

  return match[1].trim();
}

function replaceManagedBlock(content: string, start: string, end: string, body: string): string {
  const pattern = new RegExp(`${escapeForRegex(start)}\\n([\\s\\S]*?)\\n${escapeForRegex(end)}`);
  return content.replace(pattern, `${start}\n${body}\n${end}`);
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTableRows(block: string): string[][] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .slice(2)
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );
}

function unwrapCode(value: string): string {
  return value.replace(/^`|`$/g, "");
}

function renderCode(value: string): string {
  return value ? `\`${sanitizeCell(value)}\`` : "-";
}

export function parseStoryBranch(
  branch: string,
): { lane: BranchLane; storyId: string } | null {
  const match = STORY_BRANCH_PATTERN.exec(branch);

  if (!match) {
    return null;
  }

  return {
    lane: match[1] as BranchLane,
    storyId: match[2],
  };
}

export function sanitizeSummary(summary: string): string {
  const normalized = summary
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    throw new Error("Branch summary must contain letters or numbers.");
  }

  return normalized;
}

export function buildBranchName({
  lane,
  storyId,
  summary,
}: {
  lane: BranchLane;
  storyId: string;
  summary: string;
}): string {
  return `${lane}/${storyId}-${sanitizeSummary(summary)}`;
}

export function isPlaceholderDescription(description: string): boolean {
  return ["", "tbd", "todo", "pending", "...", "-", "?"].includes(
    description.trim().toLowerCase(),
  );
}

export function parseBranchTracker(content: string): ParsedTracker {
  const activeRows = parseTableRows(extractManagedBlock(content, ACTIVE_START, ACTIVE_END));
  const closedRows = parseTableRows(extractManagedBlock(content, CLOSED_START, CLOSED_END));

  return {
    active: activeRows.map(
      ([branch, storyId, lane, status, description, pr, opened, updated, base, notes]) => ({
        branch: unwrapCode(branch),
        storyId: unwrapCode(storyId),
        lane: unwrapCode(lane) as BranchLane,
        status: unwrapCode(status) as ActiveBranchStatus,
        description: sanitizeCell(description),
        pr: sanitizeCell(pr),
        opened: unwrapCode(opened),
        updated: unwrapCode(updated),
        base: unwrapCode(base),
        notes: sanitizeCell(notes),
      }),
    ),
    closed: closedRows.map(
      ([branch, storyId, lane, finalStatus, description, closed, notes]) => ({
        branch: unwrapCode(branch),
        storyId: unwrapCode(storyId),
        lane: unwrapCode(lane) as BranchLane,
        finalStatus: unwrapCode(finalStatus) as ClosedBranchStatus,
        description: sanitizeCell(description),
        closed: unwrapCode(closed),
        notes: sanitizeCell(notes),
      }),
    ),
  };
}

export function findActiveBranchEntry(
  content: string,
  branch: string,
): ActiveBranchEntry | undefined {
  return parseBranchTracker(content).active.find((entry) => entry.branch === branch);
}

function renderActiveTable(entries: ActiveBranchEntry[]): string {
  const rows = entries
    .slice()
    .sort((left, right) => left.branch.localeCompare(right.branch))
    .map(
      (entry) =>
        `| ${renderCode(entry.branch)} | ${renderCode(entry.storyId)} | ${renderCode(entry.lane)} | ${renderCode(entry.status)} | ${sanitizeCell(entry.description)} | ${sanitizeCell(entry.pr || "-")} | ${renderCode(entry.opened)} | ${renderCode(entry.updated)} | ${renderCode(entry.base)} | ${sanitizeCell(entry.notes || "-")} |`,
    );

  return [
    "| Branch | Story | Lane | Status | Description | PR | Opened | Updated | Base | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function renderClosedTable(entries: ClosedBranchEntry[]): string {
  const rows = entries
    .slice()
    .sort((left, right) => right.closed.localeCompare(left.closed) || left.branch.localeCompare(right.branch))
    .map(
      (entry) =>
        `| ${renderCode(entry.branch)} | ${renderCode(entry.storyId)} | ${renderCode(entry.lane)} | ${renderCode(entry.finalStatus)} | ${sanitizeCell(entry.description)} | ${renderCode(entry.closed)} | ${sanitizeCell(entry.notes || "-")} |`,
    );

  return [
    "| Branch | Story | Lane | Final status | Description | Closed | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function updateLastUpdated(content: string, date: string): string {
  return content.replace(
    /^Last updated: .+$/m,
    `Last updated: ${date}`,
  );
}

export function upsertActiveBranchEntry(
  content: string,
  entry: ActiveBranchEntry,
): string {
  const parsed = parseBranchTracker(content);
  const nextActive = parsed.active.filter((current) => current.branch !== entry.branch);
  nextActive.push({
    ...entry,
    description: sanitizeCell(entry.description),
    pr: sanitizeCell(entry.pr),
    notes: sanitizeCell(entry.notes),
  });
  const nextClosed = parsed.closed.filter((current) => current.branch !== entry.branch);

  let updated = replaceManagedBlock(content, ACTIVE_START, ACTIVE_END, renderActiveTable(nextActive));
  updated = replaceManagedBlock(updated, CLOSED_START, CLOSED_END, renderClosedTable(nextClosed));
  return updateLastUpdated(updated, entry.updated);
}

export function closeActiveBranchEntry(
  content: string,
  branch: string,
  closeout: {
    finalStatus: ClosedBranchStatus;
    closed: string;
    notes: string;
  },
): string {
  const parsed = parseBranchTracker(content);
  const activeEntry = parsed.active.find((entry) => entry.branch === branch);

  if (!activeEntry) {
    throw new Error(`Active branch '${branch}' was not found in the tracker.`);
  }

  const nextActive = parsed.active.filter((entry) => entry.branch !== branch);
  const nextClosed = parsed.closed.filter((entry) => entry.branch !== branch);
  nextClosed.push({
    branch: activeEntry.branch,
    storyId: activeEntry.storyId,
    lane: activeEntry.lane,
    finalStatus: closeout.finalStatus,
    description: activeEntry.description,
    closed: closeout.closed,
    notes: sanitizeCell(closeout.notes),
  });

  let updated = replaceManagedBlock(content, ACTIVE_START, ACTIVE_END, renderActiveTable(nextActive));
  updated = replaceManagedBlock(updated, CLOSED_START, CLOSED_END, renderClosedTable(nextClosed));
  return updateLastUpdated(updated, closeout.closed);
}
