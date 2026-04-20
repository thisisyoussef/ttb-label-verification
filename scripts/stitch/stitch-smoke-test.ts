import { Stitch, StitchToolClient } from "@google/stitch-sdk";
import { getStitchClientConfig } from "./stitch-auth.js";
import {
  CANONICAL_STITCH_PROJECT_ID,
  findProjectById,
  findProjectByPreferredTitle,
  getConfiguredProjectId,
  getPreferredProjectId,
} from "./stitch-project.js";

function summarizeToolNames(toolNames: string[]): string {
  return [...toolNames].sort().join(", ");
}

async function main(): Promise<void> {
  const client = new StitchToolClient(getStitchClientConfig());
  await client.connect();

  try {
    const api = new Stitch(client);
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);

    console.log("[stitch] connected");
    console.log(
      `[stitch] tools=${toolNames.length}: ${summarizeToolNames(toolNames)}`
    );

    const projects = await api.projects();
    console.log(`[stitch] projects=${projects.length}`);

    const configuredProjectId = getConfiguredProjectId();
    const selectedProjectId =
      findProjectById(projects, getPreferredProjectId())?.projectId ||
      findProjectByPreferredTitle(projects)?.projectId ||
      projects[0]?.projectId;

    if (configuredProjectId && selectedProjectId !== configuredProjectId) {
      throw new Error(
        `Configured STITCH_PROJECT_ID '${configuredProjectId}' is not accessible in the current Stitch account.`
      );
    }

    if (!selectedProjectId) {
      console.log(
        "[stitch] no project selected; auth and read-only tool access succeeded."
      );
      return;
    }

    const project = api.project(selectedProjectId);
    const screens = await project.screens();

    console.log(`[stitch] selectedProject=${selectedProjectId}`);
    if (selectedProjectId === CANONICAL_STITCH_PROJECT_ID) {
      console.log("[stitch] selectedProjectSource=canonical-project-id");
    }
    console.log(`[stitch] screens=${screens.length}`);

    const firstScreen = screens[0];
    if (firstScreen) {
      const firstScreenTitle =
        typeof firstScreen.data?.title === "string" &&
        firstScreen.data.title.trim().length > 0
          ? firstScreen.data.title.trim()
          : "untitled";

      console.log(`[stitch] firstScreen=${firstScreen.screenId}`);
      console.log(`[stitch] firstScreenTitle=${firstScreenTitle}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error("[stitch] smoke test failed");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = 1;
});
