export { DEFAULT_EXTRACTION_MODE as REVIEW_EXTRACTION_MODE } from './ai-provider-policy';

export const REVIEW_EXTRACTION_PROVIDER = 'openai';
export const REVIEW_EXTRACTION_PROMPT_PROFILE = 'review-extraction/openai-v1';
export const REVIEW_EXTRACTION_GUARDRAIL_POLICY = 'structured-output-zod-v1';

export const LLM_ENDPOINT_SURFACES = [
  '/api/review',
  '/api/review/extraction',
  '/api/review/warning',
  '/api/batch/run',
  '/api/batch/retry'
] as const;

export type LlmEndpointSurface = (typeof LLM_ENDPOINT_SURFACES)[number];
