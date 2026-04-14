import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StitchProxy } from "@google/stitch-sdk";
import { getStitchClientConfig } from "./stitch-auth.js";

async function main(): Promise<void> {
  const clientConfig = getStitchClientConfig();
  const apiKey = clientConfig.apiKey;

  if (!apiKey) {
    throw new Error(
      "An API-key-backed Stitch config is required to run the local Stitch MCP proxy. Set STITCH_API_KEY or configure X-Goog-Api-Key in the local .mcp.json stitch server entry."
    );
  }

  const proxy = new StitchProxy({
    apiKey,
    name: "ttb-label-verification-stitch",
  });

  const transport = new StdioServerTransport();
  const shutdown = async (): Promise<void> => {
    await proxy.close();
    process.exit(0);
  };

  (["SIGINT", "SIGTERM"] as NodeJS.Signals[]).forEach((signal) => {
    process.once(signal, () => {
      void shutdown();
    });
  });

  await proxy.start(transport);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[stitch-proxy] ${error.message}`);
  } else {
    console.error(`[stitch-proxy] ${String(error)}`);
  }

  process.exitCode = 1;
});
