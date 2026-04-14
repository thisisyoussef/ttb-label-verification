import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export type StitchClientConfig = {
  apiKey?: string;
  accessToken?: string;
  projectId?: string;
};

type McpConfig = {
  mcpServers?: Record<string, McpServer>;
  servers?: Record<string, McpServer>;
};

type McpServer = {
  headers?: Record<string, string>;
};

const LOCAL_MCP_CONFIG_PATHS = [
  path.join(process.cwd(), ".mcp.json"),
  path.join(process.cwd(), ".cursor", "mcp.json"),
];

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function getStitchServer(config: McpConfig | null): McpServer | null {
  if (!config) {
    return null;
  }

  return config.mcpServers?.stitch || config.servers?.stitch || null;
}

function getBearerToken(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function getClientConfigFromLocalMcp(): StitchClientConfig | null {
  for (const configPath of LOCAL_MCP_CONFIG_PATHS) {
    const config = readJsonFile<McpConfig>(configPath);
    const stitchServer = getStitchServer(config);
    const headers = stitchServer?.headers;

    if (!headers) {
      continue;
    }

    const apiKey = headers["X-Goog-Api-Key"]?.trim();
    if (apiKey) {
      return { apiKey };
    }

    const accessToken = getBearerToken(headers.Authorization);
    const projectId = headers["X-Goog-User-Project"]?.trim();

    if (accessToken && projectId) {
      return { accessToken, projectId };
    }
  }

  return null;
}

export function getStitchClientConfig(): StitchClientConfig {
  const apiKey = process.env.STITCH_API_KEY?.trim();
  if (apiKey) {
    return { apiKey };
  }

  const accessToken = process.env.STITCH_ACCESS_TOKEN?.trim();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim();

  if (accessToken && projectId) {
    return { accessToken, projectId };
  }

  const fromLocalMcp = getClientConfigFromLocalMcp();
  if (fromLocalMcp) {
    return fromLocalMcp;
  }

  throw new Error(
    "Missing Stitch auth. Set STITCH_API_KEY, or set STITCH_ACCESS_TOKEN plus GOOGLE_CLOUD_PROJECT, or configure a local Stitch MCP entry in .mcp.json."
  );
}
