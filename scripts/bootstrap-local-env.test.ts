import { describe, expect, it } from 'vitest';

import { renderEnvFile } from './bootstrap-local-env';

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
});
