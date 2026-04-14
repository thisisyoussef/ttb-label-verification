import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Stitch, StitchToolClient } from "@google/stitch-sdk";
import { getStitchClientConfig } from "./stitch-auth.js";
import {
  getStitchFlowMode,
  requireAutomatedStitchFlow,
} from "./stitch-flow-mode.js";
import {
  findProjectById,
  findProjectByPreferredTitle,
  getConfiguredProjectId,
  getPreferredProjectId,
  getPreferredProjectTitle,
} from "./stitch-project.js";

type GeneratedScreen = {
  id: string;
  name?: string;
  title?: string;
  htmlUrl?: string;
  screenshotUrl?: string;
};

type ScreenArtifact = {
  id: string;
  name?: string;
  title: string;
  htmlUrl: string;
  screenshotUrl: string;
  localHtmlPath: string | null;
  htmlFetchError: string | null;
};

type ProjectScreenSnapshot = {
  id: string;
  title?: string;
};

type GenerationChildInput = {
  projectId: string;
  prompt: string;
  modelId: string;
  deviceType: string;
};

function getStoryId(): string {
  const storyId = process.argv[2]?.trim();

  if (!storyId) {
    throw new Error("Usage: npm run stitch:story -- <story-id>");
  }

  return storyId;
}

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

function extractPrompt(markdown: string): string {
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function getTimestampSlug(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function getDisplayTimestamp(date = new Date()): string {
  return date.toISOString();
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

function collectGeneratedScreens(raw: unknown): GeneratedScreen[] {
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

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchText(url: string): Promise<string> {
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

async function listProjectScreens(
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

function findNewScreens(
  before: ProjectScreenSnapshot[],
  after: ProjectScreenSnapshot[]
): ProjectScreenSnapshot[] {
  const beforeIds = new Set(before.map((screen) => screen.id));
  return after.filter((screen) => !beforeIds.has(screen.id));
}

async function runGenerateScreenCall(
  input: GenerationChildInput,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const tsxPath = path.resolve("node_modules/.bin/tsx");
  const helperPath = path.resolve("scripts/stitch-generate-screen.ts");

  return new Promise((resolve, reject) => {
    const child = spawn(tsxPath, [helperPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const finalize = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");

      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 5000).unref();
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timeoutHandle);
      finalize(() => {
        reject(error);
      });
    });

    child.on("close", (code, signal) => {
      clearTimeout(timeoutHandle);

      if (timedOut) {
        finalize(() => {
          reject(
            new Error(
              `Stitch generation timed out after ${timeoutMs}ms. Adjust STITCH_GENERATION_TIMEOUT_MS if you want to wait longer.${
                stderr.trim() ? ` Last stderr: ${stderr.trim()}` : ""
              }`
            )
          );
        });
        return;
      }

      if (code !== 0) {
        finalize(() => {
          reject(
            new Error(
              stderr.trim() ||
                stdout.trim() ||
                `Stitch generation helper exited with code ${String(
                  code
                )} and signal ${String(signal)}.`
            )
          );
        });
        return;
      }

      finalize(() => {
        try {
          resolve(JSON.parse(stdout) as Record<string, unknown>);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse Stitch generation response. ${
                error instanceof Error ? error.message : String(error)
              }`
            )
          );
        }
      });
    });

    child.stdin.end(JSON.stringify(input));
  });
}

async function resolveProject(api: Stitch): Promise<{
  projectId: string;
  projectTitle: string;
  wasCreated: boolean;
}> {
  const configuredProjectId = getConfiguredProjectId();
  const preferredProjectId = getPreferredProjectId();
  const desiredTitle = getPreferredProjectTitle();
  const projects = await api.projects();
  const existingById = findProjectById(projects, preferredProjectId);

  if (existingById) {
    return {
      projectId: preferredProjectId,
      projectTitle:
        existingById.data?.title || desiredTitle || preferredProjectId,
      wasCreated: false,
    };
  }

  if (configuredProjectId) {
    throw new Error(
      `Configured STITCH_PROJECT_ID '${configuredProjectId}' is not accessible in the current Stitch account.`
    );
  }

  const existingByTitle = findProjectByPreferredTitle(projects);

  if (existingByTitle) {
    return {
      projectId: existingByTitle.projectId,
      projectTitle: existingByTitle.data?.title || desiredTitle,
      wasCreated: false,
    };
  }

  const created = await api.createProject(desiredTitle);

  return {
    projectId: created.projectId,
    projectTitle: created.data?.title || desiredTitle,
    wasCreated: true,
  };
}

async function waitForArtifacts(
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

function buildBriefAppendix(input: {
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

function appendToReturnedReferencesSection(
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

async function main(): Promise<void> {
  const flowMode = getStitchFlowMode();
  requireAutomatedStitchFlow(flowMode);

  const storyId = getStoryId();
  const briefPath = path.resolve(
    `docs/specs/${storyId}/stitch-screen-brief.md`
  );
  const storyDir = path.dirname(briefPath);
  const briefMarkdown = await readFile(briefPath, "utf8");
  const prompt = extractPrompt(briefMarkdown);
  const client = new StitchToolClient(getStitchClientConfig());
  await client.connect();

  const runTimestamp = getTimestampSlug();
  const runDisplayTimestamp = getDisplayTimestamp();
  const reviewRequired =
    (process.env.STITCH_AUTOMATION_REVIEW_REQUIRED || "true")
      .trim()
      .toLowerCase() !== "false";
  const deviceType = process.env.STITCH_DEVICE_TYPE?.trim() || "DESKTOP";
  const modelId = process.env.STITCH_MODEL_ID?.trim() || "GEMINI_3_1_PRO";
  const generationTimeoutMs = Number(
    process.env.STITCH_GENERATION_TIMEOUT_MS || "180000"
  );

  try {
    const api = new Stitch(client);
    const projectInfo = await resolveProject(api);
    const project = api.project(projectInfo.projectId);
    const runDir = path.resolve(
      storyDir,
      "stitch-refs",
      "automated",
      runTimestamp
    );
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, "prompt.txt"), `${prompt}\n`);

    console.log(
      `[stitch] story=${storyId} flow=${flowMode} project=${projectInfo.projectTitle}`
    );

    const beforeScreens = await listProjectScreens(api, projectInfo.projectId);
    await writeFile(
      path.join(runDir, "pre-generation-screens.json"),
      JSON.stringify(beforeScreens, null, 2)
    );

    let raw: Record<string, unknown>;

    try {
      raw = await runGenerateScreenCall(
        {
          projectId: projectInfo.projectId,
          prompt,
          deviceType,
          modelId,
        },
        generationTimeoutMs
      );
    } catch (error) {
      const afterScreens = await listProjectScreens(api, projectInfo.projectId).catch(
        () => null
      );
      const newScreens = afterScreens
        ? findNewScreens(beforeScreens, afterScreens)
        : [];
      const inspectionPath = path.join(runDir, "generation-inspection.json");
      const message = error instanceof Error ? error.message : String(error);

      await writeFile(
        inspectionPath,
        JSON.stringify(
          {
            storyId,
            generatedAt: runDisplayTimestamp,
            flowMode,
            project: {
              id: projectInfo.projectId,
              title: projectInfo.projectTitle,
              wasCreated: projectInfo.wasCreated,
            },
            modelId,
            deviceType,
            generationTimeoutMs,
            error: message,
            beforeScreens,
            afterScreens,
            newScreens,
          },
          null,
          2
        )
      );

      throw new Error(
        `${message} Inspect ${path.relative(
          process.cwd(),
          inspectionPath
        )} before retrying.${
          newScreens.length > 0
            ? ` New screens appeared despite the failed call: ${newScreens
                .map(
                  (screen) =>
                    `${screen.id}${screen.title ? ` (${screen.title})` : ""}`
                )
                .join(", ")}.`
            : " No new screens were detected after the failed call."
        }`
      );
    }

    const rawResponsePath = path.join(runDir, "raw-response.json");
    await writeFile(rawResponsePath, JSON.stringify(raw, null, 2));

    const generatedScreens = collectGeneratedScreens(raw);
    if (generatedScreens.length === 0) {
      throw new Error(
        `Stitch returned no projected screens. Check ${path.relative(
          process.cwd(),
          rawResponsePath
        )} for details.`
      );
    }

    await writeFile(
      path.join(runDir, "generation-request.json"),
      JSON.stringify(
        {
          projectId: projectInfo.projectId,
          modelId,
          deviceType,
          promptSource: path.relative(process.cwd(), briefPath),
          promptLength: prompt.length,
        },
        null,
        2
      )
    );

    const screens: ScreenArtifact[] = [];

    for (const [index, screen] of generatedScreens.entries()) {
      const artifact =
        screen.htmlUrl && screen.screenshotUrl
          ? {
              htmlUrl: screen.htmlUrl,
              screenshotUrl: screen.screenshotUrl,
              title: screen.title || `Screen ${index + 1}`,
              name: screen.name,
            }
          : await waitForArtifacts(project.projectId, screen.id, client);
      let localHtmlPath: string | null = null;
      let htmlFetchError: string | null = null;

      if (artifact.htmlUrl) {
        try {
          const htmlContent = await fetchText(artifact.htmlUrl);
          const fileName = `${String(index + 1).padStart(2, "0")}-${slugify(
            artifact.title || `screen-${index + 1}`
          )}.html`;
          const htmlPath = path.join(runDir, fileName);
          await writeFile(htmlPath, htmlContent);
          localHtmlPath = path.relative(process.cwd(), htmlPath);
        } catch (error) {
          htmlFetchError =
            error instanceof Error ? error.message : String(error);
        }
      }

      screens.push({
        id: screen.id,
        name: artifact.name || screen.name,
        title: artifact.title || screen.title || `Screen ${index + 1}`,
        htmlUrl: artifact.htmlUrl,
        screenshotUrl: artifact.screenshotUrl,
        localHtmlPath,
        htmlFetchError,
      });
    }

    const manifest = {
      storyId,
      generatedAt: runDisplayTimestamp,
      flowMode,
      reviewRequired,
      project: {
        id: projectInfo.projectId,
        title: projectInfo.projectTitle,
        wasCreated: projectInfo.wasCreated,
      },
      modelId,
      deviceType,
      promptSource: path.relative(process.cwd(), briefPath),
      runDir: path.relative(process.cwd(), runDir),
      screens,
    };

    const manifestPath = path.join(runDir, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const appendix = buildBriefAppendix({
      generatedAt: runDisplayTimestamp,
      flowMode,
      reviewRequired,
      projectId: projectInfo.projectId,
      projectTitle: projectInfo.projectTitle,
      modelId,
      deviceType,
      runDirRelative: path.relative(process.cwd(), runDir),
      manifestRelative: path.relative(process.cwd(), manifestPath),
      rawResponseRelative: path.relative(process.cwd(), rawResponsePath),
      screens,
    });

    const updatedBrief = appendToReturnedReferencesSection(
      briefMarkdown,
      appendix
    );
    await writeFile(briefPath, updatedBrief);

    console.log(`[stitch] generatedScreens=${screens.length}`);
    console.log(`[stitch] artifactDir=${path.relative(process.cwd(), runDir)}`);
    console.log(`[stitch] manifest=${path.relative(process.cwd(), manifestPath)}`);
    console.log(
      `[stitch] reviewRequired=${String(reviewRequired)} (stop for user review before implementation)`
    );
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error("[stitch] automated story run failed");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = 1;
});
