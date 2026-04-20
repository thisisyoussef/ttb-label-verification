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
import {
  appendToReturnedReferencesSection,
  buildBriefAppendix,
  collectGeneratedScreens,
  fetchText,
  findNewScreens,
  getDisplayTimestamp,
  getStoryId,
  getTimestampSlug,
  listProjectScreens,
  slugify,
  waitForArtifacts,
  type ScreenArtifact,
  extractPrompt,
} from "./stitch-story-helpers.js";

type GenerationChildInput = {
  projectId: string;
  prompt: string;
  modelId: string;
  deviceType: string;
};

async function runGenerateScreenCall(
  input: GenerationChildInput,
  timeoutMs: number
): Promise<Record<string, unknown>> {
  const tsxPath = path.resolve("node_modules/.bin/tsx");
  const helperPath = path.resolve("scripts/stitch/stitch-generate-screen.ts");

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
