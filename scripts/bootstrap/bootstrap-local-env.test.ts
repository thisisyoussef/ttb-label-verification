import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { bootstrapLocalEnv, renderEnvFile } from './bootstrap-local-env';

const tempDirs: string[] = [];

function createTempDir() {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'bootstrap-local-env-'));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

describe('bootstrap local env script', () => {
  it('does not duplicate ordered Gemini and Ollama keys in the rendered .env and defaults label extraction to gemini first', () => {
    const rendered = renderEnvFile({
      OPENAI_API_KEY: 'redacted-openai',
      GEMINI_API_KEY: '',
      GEMINI_VISION_MODEL: 'gemini-2.5-flash-lite',
      GEMINI_TEXT_MODEL: '',
      GEMINI_EMBEDDING_MODEL: '',
      AI_CAPABILITY_DEFAULT_ORDER: 'openai,gemini',
      AI_CAPABILITY_LABEL_EXTRACTION_ORDER: 'gemini,openai',
      AI_EXTRACTION_MODE_DEFAULT: 'cloud',
      AI_EXTRACTION_MODE_ALLOW_LOCAL: 'false',
      OLLAMA_HOST: 'http://localhost:11434',
      OLLAMA_LABEL_EXTRACTION_MODEL: '',
      PORT: '8787'
    });

    expect(rendered.match(/^GEMINI_API_KEY=/gm)).toHaveLength(1);
    expect(rendered.match(/^OLLAMA_HOST=/gm)).toHaveLength(1);
    expect(rendered).toContain('AI_CAPABILITY_LABEL_EXTRACTION_ORDER=gemini,openai');
  });

  it('hydrates Gemini and OpenAI keys from a sibling repo env inventory', () => {
    const gauntletRoot = createTempDir();
    const seededRepoDir = path.join(gauntletRoot, 'ttb-label-verification');
    const isolatedWorktreeDir = path.join(gauntletRoot, 'ttb-label-verification-wf-003');

    mkdirSync(seededRepoDir, { recursive: true });
    mkdirSync(isolatedWorktreeDir, { recursive: true });
    writeFileSync(path.join(seededRepoDir, '.env'), 'OPENAI_API_KEY=seed-openai\nGEMINI_API_KEY=seed-gemini\n', 'utf8');
    const result = bootstrapLocalEnv(isolatedWorktreeDir);
    const bootstrappedEnv = readFileSync(path.join(isolatedWorktreeDir, '.env'), 'utf8');

    expect(result.sourceDescriptions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('OPENAI_API_KEY'),
        expect.stringContaining('GEMINI_API_KEY'),
      ]),
    );
    expect(bootstrappedEnv).toContain('OPENAI_API_KEY=seed-openai');
    expect(bootstrappedEnv).toContain('GEMINI_API_KEY=seed-gemini');
  });
});
