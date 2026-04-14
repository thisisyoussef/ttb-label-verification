import { describe, expect, it } from 'vitest';

import {
  buildLangSmithProcessEnv,
  DEFAULT_LANGSMITH_PROJECT,
  readLangSmithConfig
} from './langsmith-config';

describe('LangSmith config', () => {
  it('defaults tracing off and uses the repo project name', () => {
    const config = readLangSmithConfig({});

    expect(config.apiKey).toBeUndefined();
    expect(config.project).toBe(DEFAULT_LANGSMITH_PROJECT);
    expect(config.tracingEnabled).toBe(false);
  });

  it('falls back to legacy LangChain environment keys', () => {
    const config = readLangSmithConfig({
      LANGCHAIN_API_KEY: 'legacy-key',
      LANGCHAIN_PROJECT: 'legacy-project',
      LANGCHAIN_TRACING_V2: 'true'
    });

    expect(config.apiKey).toBe('legacy-key');
    expect(config.project).toBe('legacy-project');
    expect(config.tracingEnabled).toBe(true);
  });

  it('normalizes the process environment for current and legacy consumers', () => {
    const processEnv = buildLangSmithProcessEnv({
      LANGCHAIN_API_KEY: 'legacy-key',
      LANGCHAIN_PROJECT: 'legacy-project',
      LANGCHAIN_TRACING_V2: 'true'
    });

    expect(processEnv.LANGSMITH_API_KEY).toBe('legacy-key');
    expect(processEnv.LANGCHAIN_API_KEY).toBe('legacy-key');
    expect(processEnv.LANGSMITH_PROJECT).toBe('legacy-project');
    expect(processEnv.LANGCHAIN_PROJECT).toBe('legacy-project');
    expect(processEnv.LANGSMITH_TRACING).toBe('true');
    expect(processEnv.LANGCHAIN_TRACING_V2).toBe('true');
  });
});
