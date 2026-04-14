import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadLocalEnv, parseDotEnvContents } from './load-local-env';

const tempDirsToRemove: string[] = [];
const managedEnvKeys = ['OPENAI_API_KEY', 'OPENAI_MODEL', 'PORT', 'FROM_LOCAL_ONLY'];
const originalEnv = new Map(
  managedEnvKeys.map((key) => [key, process.env[key]])
);

afterEach(() => {
  tempDirsToRemove.splice(0).forEach((dirPath) => {
    rmSync(dirPath, { recursive: true, force: true });
  });

  for (const [key, value] of originalEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
});

describe('loadLocalEnv', () => {
  it('parses dotenv content with quotes and inline comments', () => {
    const parsed = parseDotEnvContents(`
OPENAI_MODEL=gpt-5.4-mini
PORT=8787 # local port
QUOTED="hello world"
SINGLE='keep # inside'
`);

    expect(parsed.OPENAI_MODEL).toBe('gpt-5.4-mini');
    expect(parsed.PORT).toBe('8787');
    expect(parsed.QUOTED).toBe('hello world');
    expect(parsed.SINGLE).toBe('keep # inside');
  });

  it('loads .env and lets .env.local override .env while preserving inherited vars', () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'ttb-env-load-'));
    tempDirsToRemove.push(tempDir);

    writeFileSync(
      path.join(tempDir, '.env'),
      'OPENAI_API_KEY=from-dot-env\nOPENAI_MODEL=gpt-5.4-mini\nPORT=8787\n'
    );
    writeFileSync(
      path.join(tempDir, '.env.local'),
      'OPENAI_API_KEY=from-dot-env-local\nFROM_LOCAL_ONLY=yes\nPORT=9000\n'
    );

    process.env.PORT = '9999';
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.FROM_LOCAL_ONLY;

    const loadedFiles = loadLocalEnv(tempDir);

    expect(loadedFiles).toHaveLength(2);
    expect(process.env.OPENAI_API_KEY).toBe('from-dot-env-local');
    expect(process.env.OPENAI_MODEL).toBe('gpt-5.4-mini');
    expect(process.env.FROM_LOCAL_ONLY).toBe('yes');
    expect(process.env.PORT).toBe('9999');
  });
});
