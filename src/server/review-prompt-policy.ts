import type { ExtractionMode } from './ai-provider-policy';
import type { LlmEndpointSurface } from './llm-policy';

export type ReviewPromptSurface = 'review' | 'extraction' | 'warning' | 'batch';

export type ReviewPromptPolicy = {
  surface: ReviewPromptSurface;
  extractionMode: ExtractionMode;
  promptProfile: string;
  guardrailPolicy: string;
  prompt: string;
};

type ReviewPromptPolicyInput = {
  surface: LlmEndpointSurface | ReviewPromptSurface;
  extractionMode: ExtractionMode;
};

const BASELINE_INSTRUCTIONS = [
  'You observe. You do not judge.',
  'Extract label facts from this alcohol beverage label and return structured output only.',
  'Never make a final compliance judgment.',
  'Never guess unsupported field values.',
  'Never copy label facts from application inputs or infer them from external expectations.',
  'Never compare extracted text against any "correct" or "expected" value.',
  'Only report what is visibly supported by the submitted label image.',
  'For every field, mark present=true only when the label image supports the extraction. If a field is absent, set present=false and omit the value.',
  'Use confidence between 0 and 1.',
  'Do not silently omit low-confidence ambiguity. Preserve it with confidence and notes.',
  'Assess image quality, and set noTextDetected=true only when no readable label text can be extracted.',
  'Estimate warning visual signals for all-caps prefix, bold prefix, continuous paragraph, and visual separation.',
  'Provide a beverageTypeHint only when the label content supports it; otherwise use unknown.',
  'Populate the structured fields exactly as named, including governmentWarning when warning text is visible.'
] as const;

const ENDPOINT_OVERLAYS: Record<ReviewPromptSurface, readonly string[]> = {
  review: [
    'Optimize for balanced extraction that preserves reviewer trust for downstream deterministic comparison.',
    'Prefer abstention over overcalling cosmetic or ambiguous differences.'
  ],
  extraction: [
    'Maximize bounded field coverage, confidence, and notes without changing the typed contract.',
    'Preserve useful uncertainty so extraction-only debugging remains actionable.'
  ],
  warning: [
    'Prioritize exact government warning text, punctuation, and warning visual signals.',
    'If warning evidence is weak, say so explicitly instead of upgrading it into certainty.'
  ],
  batch: [
    'Optimize for stable item-level extraction under repeated batch execution.',
    'Keep degradation item-local and concise so one weak label does not inflate session-wide noise.'
  ]
} as const;

const MODE_OVERLAYS: Record<ExtractionMode, readonly string[]> = {
  cloud: [
    'Cloud mode should maximize accurate field and visual-signal coverage without overcalling.'
  ],
  local: [
    'Local mode must preserve readable text but abstain on weak formatting or spatial judgments.',
    'Never up-rank unsupported visual reasoning in local mode.'
  ]
} as const;

export function resolveReviewPromptSurface(
  surface: LlmEndpointSurface | ReviewPromptSurface
): ReviewPromptSurface {
  switch (surface) {
    case '/api/review':
    case 'review':
      return 'review';
    case '/api/review/extraction':
    case 'extraction':
      return 'extraction';
    case '/api/review/warning':
    case 'warning':
      return 'warning';
    case '/api/batch/run':
    case '/api/batch/retry':
    case 'batch':
      return 'batch';
  }
}

export function resolveReviewPromptPolicy(
  input: ReviewPromptPolicyInput
): ReviewPromptPolicy {
  const surface = resolveReviewPromptSurface(input.surface);
  const extractionMode = input.extractionMode;

  return {
    surface,
    extractionMode,
    promptProfile: `review-extraction/${surface}-${extractionMode}-v1`,
    guardrailPolicy: `review-extraction/structural-guardrails-${extractionMode}-v1`,
    prompt: [
      ...BASELINE_INSTRUCTIONS,
      ...ENDPOINT_OVERLAYS[surface],
      ...MODE_OVERLAYS[extractionMode]
    ].join(' ')
  };
}

export function buildReviewExtractionPrompt(input: ReviewPromptPolicyInput) {
  return resolveReviewPromptPolicy(input).prompt;
}
