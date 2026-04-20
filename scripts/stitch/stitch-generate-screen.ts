import { StitchToolClient } from "@google/stitch-sdk";
import { getStitchClientConfig } from "./stitch-auth.js";

type GenerateInput = {
  projectId: string;
  prompt: string;
  modelId: string;
  deviceType: string;
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const inputText = await readStdin();
  if (!inputText.trim()) {
    throw new Error("Missing generation payload on stdin.");
  }

  const input = JSON.parse(inputText) as GenerateInput;
  const client = new StitchToolClient(getStitchClientConfig());
  await client.connect();

  try {
    const raw = await client.callTool<Record<string, unknown>>(
      "generate_screen_from_text",
      {
        projectId: input.projectId,
        prompt: input.prompt,
        modelId: input.modelId,
        deviceType: input.deviceType,
      }
    );

    process.stdout.write(JSON.stringify(raw));
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = 1;
});
