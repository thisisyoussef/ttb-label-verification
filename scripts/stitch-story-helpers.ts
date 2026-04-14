import { Stitch, StitchToolClient } from "@google/stitch-sdk";

export type GeneratedScreen = {
  id: string;
  name?: string;
  title?: string;
  htmlUrl?: string;
  screenshotUrl?: string;
};

export type ScreenArtifact = {
  id: string;
  name?: string;
  title: string;
  htmlUrl: string;
  screenshotUrl: string;
  localHtmlPath: string | null;
  htmlFetchError: string | null;
};

export type ProjectScreenSnapshot = {
  id: string;
  title?: string;
};

function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const startIndex = lines.findIndex((line) => line.trim() === heading);

  if (startIndex === -1) {
    throw new Error(`Could not find section heading: ${heading}`);
  }

  const sectionLines: string[] = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.startsWith("## ")) {
      break;
    }

    sectionLines.push(line);
  }

  return sectionLines.join("\n").trim();
}

function getScreenId(screen: Record<string, unknown>): string | null {
  if (typeof screen.id === "string" && screen.id.trim().length > 0) {
    return screen.id.trim();
  }

  if (typeof screen.name === "string") {
    const parts = screen.name.split("/screens/");
    if (parts.length === 2 && parts[1].trim().length > 0) {
      return parts[1].trim();
    }
  }

  return null;
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export function getStoryId(): string {
  const storyId = process.argv[2]?.trim();

  if (!storyId) {
    throw new Error("Usage: npm run stitch:story -- <story-id>");
  }

  return storyId;
}

export function extractPrompt(markdown: string): string {
  const promptSection = extractSection(markdown, "## 3. Screen prompt for Stitch");
  const stripped = promptSection
    .split("\n")
    .map((line) => line.replace(/^>\s?/, ""))
    .join("\n")
    .trim();

  if (!stripped) {
    throw new Error("The Stitch prompt section is empty.");
  }

  return stripped;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function getTimestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function getDisplayTimestamp(date = new Date()): string {
  return date.toISOString();
}

export function collectGeneratedScreens(raw: unknown): GeneratedScreen[] {
  const rawObject =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const outputComponents = Array.isArray(rawObject.outputComponents)
    ? rawObject.outputComponents
    : [];

  const deduped = new Map<string, GeneratedScreen>();

  for (const component of outputComponents) {
    if (!component || typeof component !== "object") {
      continue;
    }

    const design = (component as Record<string, unknown>).design;
    if (!design || typeof design !== "object") {
      continue;
    }

    const screens = (design as Record<string, unknown>).screens;
    if (!Array.isArray(screens)) {
      continue;
    }

    for (const screen of screens) {
      if (!screen || typeof screen !== "object") {
        continue;
      }

      const screenRecord = screen as Record<string, unknown>;
      const id = getScreenId(screenRecord);

      if (!id || deduped.has(id)) {
        continue;
      }

      deduped.set(id, {
        id,
        name:
          typeof screenRecord.name === "string" ? screenRecord.name : undefined,
        title:
          typeof screenRecord.title === "string"
            ? screenRecord.title
            : undefined,
        htmlUrl:
          screenRecord.htmlCode &&
          typeof screenRecord.htmlCode === "object" &&
          typeof (screenRecord.htmlCode as Record<string, unknown>).downloadUrl ===
            "string"
            ? ((screenRecord.htmlCode as Record<string, unknown>)
                .downloadUrl as string)
            : undefined,
        screenshotUrl:
          screenRecord.screenshot &&
          typeof screenRecord.screenshot === "object" &&
          typeof (screenRecord.screenshot as Record<string, unknown>)
            .downloadUrl === "string"
            ? ((screenRecord.screenshot as Record<string, unknown>)
                .downloadUrl as string)
            : undefined,
      });
    }
  }

  return [...deduped.values()];
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(
      Number(process.env.STITCH_DOWNLOAD_TIMEOUT_MS || "60000")
    ),
  });

  if (!response.ok) {
    throw new Error(`Download failed with ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function listProjectScreens(
  api: Stitch,
  projectId: string
): Promise<ProjectScreenSnapshot[]> {
  const project = api.project(projectId);
  const screens = await project.screens();

  return screens.map((screen) => ({
    id: screen.screenId,
    title:
      typeof screen.data?.title === "string" ? screen.data.title : undefined,
  }));
}

export function findNewScreens(
  before: ProjectScreenSnapshot[],
  after: ProjectScreenSnapshot[]
): ProjectScreenSnapshot[] {
  const beforeIds = new Set(before.map((screen) => screen.id));
  return after.filter((screen) => !beforeIds.has(screen.id));
}

export async function waitForArtifacts(
  projectId: string,
  screenId: string,
  client: StitchToolClient
): Promise<{
  htmlUrl: string;
  screenshotUrl: string;
  title: string;
  name?: string;
}> {
  const timeoutMs = Number(process.env.STITCH_POLL_TIMEOUT_MS || "360000");
  const intervalMs = Number(process.env.STITCH_POLL_INTERVAL_MS || "10000");
  const startedAt = Date.now();
  let lastStatus = "UNKNOWN";

  while (Date.now() - startedAt < timeoutMs) {
    const raw = await client.callTool<Record<string, unknown>>("get_screen", {
      projectId,
      screenId,
      name: `projects/${projectId}/screens/${screenId}`,
    });

    const screenMetadata =
      raw.screenMetadata && typeof raw.screenMetadata === "object"
        ? (raw.screenMetadata as Record<string, unknown>)
        : {};
    const status =
      typeof screenMetadata.status === "string"
        ? screenMetadata.status
        : "UNKNOWN";
    const htmlCode =
      raw.htmlCode && typeof raw.htmlCode === "object"
        ? (raw.htmlCode as Record<string, unknown>)
        : {};
    const screenshot =
      raw.screenshot && typeof raw.screenshot === "object"
        ? (raw.screenshot as Record<string, unknown>)
        : {};
    const htmlUrl =
      typeof htmlCode.downloadUrl === "string" ? htmlCode.downloadUrl : "";
    const screenshotUrl =
      typeof screenshot.downloadUrl === "string" ? screenshot.downloadUrl : "";

    if (status !== lastStatus) {
      console.log(`[stitch] screen ${screenId} status=${status}`);
      lastStatus = status;
    }

    if (status === "FAILED") {
      const statusMessage =
        typeof screenMetadata.statusMessage === "string"
          ? screenMetadata.statusMessage
          : "unknown Stitch failure";
      throw new Error(`Screen ${screenId} failed generation: ${statusMessage}`);
    }

    if (status === "COMPLETE" && htmlUrl && screenshotUrl) {
      return {
        htmlUrl,
        screenshotUrl,
        title: typeof raw.title === "string" ? raw.title : "Untitled screen",
        name: typeof raw.name === "string" ? raw.name : undefined,
      };
    }

    await delay(intervalMs);
  }

  throw new Error(
    `Timed out waiting for Stitch artifacts for screen ${screenId}. Increase STITCH_POLL_TIMEOUT_MS if needed.`
  );
}

export function buildBriefAppendix(input: {
  generatedAt: string;
  flowMode: string;
  reviewRequired: boolean;
  projectId: string;
  projectTitle: string;
  modelId: string;
  deviceType: string;
  runDirRelative: string;
  manifestRelative: string;
  rawResponseRelative: string;
  screens: ScreenArtifact[];
}): string {
  const screenLines = input.screens
    .map((screen, index) => {
      const lines = [
        `${index + 1}. \`${screen.title}\``,
        `   - screen id: \`${screen.id}\``,
      ];

      if (screen.localHtmlPath) {
        lines.push(`   - local HTML copy: \`${screen.localHtmlPath}\``);
      }

      if (screen.htmlFetchError) {
        lines.push(`   - local HTML copy error: ${screen.htmlFetchError}`);
      }

      lines.push(`   - HTML source URL: ${screen.htmlUrl}`);
      lines.push(`   - screenshot URL: ${screen.screenshotUrl}`);

      return lines.join("\n");
    })
    .join("\n");

  return [
    `### Automated run — ${input.generatedAt}`,
    "",
    `- flow mode: \`${input.flowMode}\``,
    `- user review required before implementation: \`${String(
      input.reviewRequired
    )}\``,
    `- project: \`${input.projectTitle}\` (\`${input.projectId}\`)`,
    `- model: \`${input.modelId}\``,
    `- device type: \`${input.deviceType}\``,
    `- artifact folder: \`${input.runDirRelative}\``,
    `- manifest: \`${input.manifestRelative}\``,
    `- raw response: \`${input.rawResponseRelative}\``,
    "",
    "#### Generated screens",
    "",
    screenLines,
  ].join("\n");
}

export function appendToReturnedReferencesSection(
  markdown: string,
  appendix: string
): string {
  const heading = "## 8. Returned Stitch references";
  const startIndex = markdown.indexOf(heading);

  if (startIndex === -1) {
    return `${markdown.trim()}\n\n${heading}\n\n${appendix}\n`;
  }

  const afterHeading = startIndex + heading.length;
  const rest = markdown.slice(afterHeading);
  const nextHeadingOffset = rest.search(/\n##\s+/);

  if (nextHeadingOffset === -1) {
    return `${markdown.trim()}\n\n${appendix}\n`;
  }

  const insertionPoint = afterHeading + nextHeadingOffset;
  return `${markdown.slice(0, insertionPoint).trimEnd()}\n\n${appendix}\n\n${markdown
    .slice(insertionPoint)
    .trimStart()}`;
}
