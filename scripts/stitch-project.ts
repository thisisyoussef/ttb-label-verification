export const CANONICAL_STITCH_PROJECT_ID = "3197911668966401642";
export const CANONICAL_STITCH_PROJECT_TITLE = "TTB Label Verification System";

type StitchProjectLike = {
  projectId: string;
  data?: {
    title?: string;
  };
};

export function normalizeProjectTitle(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getConfiguredProjectId(): string | undefined {
  return process.env.STITCH_PROJECT_ID?.trim() || undefined;
}

export function getPreferredProjectId(): string {
  return getConfiguredProjectId() || CANONICAL_STITCH_PROJECT_ID;
}

export function getPreferredProjectTitle(): string {
  return (
    process.env.STITCH_PROJECT_TITLE?.trim() || CANONICAL_STITCH_PROJECT_TITLE
  );
}

export function findProjectById<T extends StitchProjectLike>(
  projects: T[],
  projectId: string
): T | undefined {
  return projects.find((project) => project.projectId === projectId);
}

export function findProjectByPreferredTitle<T extends StitchProjectLike>(
  projects: T[]
): T | undefined {
  const desiredTitle = getPreferredProjectTitle();

  return projects.find(
    (project) =>
      normalizeProjectTitle(project.data?.title) ===
      normalizeProjectTitle(desiredTitle)
  );
}
