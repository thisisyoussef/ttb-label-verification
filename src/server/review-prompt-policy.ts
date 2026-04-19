import type { ExtractionMode } from './ai-provider-policy';
import type { LlmEndpointSurface } from './llm-policy';
import type { NormalizedReviewFields } from './review-intake';

export type ReviewPromptSurface = 'review' | 'extraction' | 'warning';

/**
 * Set of identifier fields that the verification-mode prompt asks the
 * model to verify against applicant-declared values, rather than to
 * extract bottom-up. Numeric / canonical fields stay bottom-up — see
 * `docs/specs/verification-mode-extraction.md`.
 */
export const VERIFICATION_MODE_IDENTIFIER_FIELDS = [
  'brandName',
  'fancifulName',
  'classType',
  'countryOfOrigin',
  'applicantAddress'
] as const;

export type VerificationModeIdentifierField =
  (typeof VERIFICATION_MODE_IDENTIFIER_FIELDS)[number];

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
  'Populate the structured fields exactly as named, including governmentWarning when warning text is visible.',
  // applicantAddress disambiguation: per 27 CFR §§ 4.35, 5.63, 7.24,
  // this field is the NAME AND ADDRESS of the bottler, packer, or
  // importer as it appears on the label — typically as a single
  // printed line like "Bottled by Acme Brewing, 306 Main St., Boston,
  // MA". The bottler/producer name qualifies even without a street
  // address. What does NOT qualify: a marketing website, social
  // handle, or email address. The VLM sometimes emits URLs here
  // because a URL is semantically an "address" too; the guardrail
  // rejects those downstream.
  'The applicantAddress field is the NAME AND/OR POSTAL ADDRESS of the bottler, packer, or importer, as printed on the label (e.g. "Bottled by Acme Brewery, Boston, MA 02210", or "Bottled by Acme Brewery" without a street if no street is printed). A producer/bottler name alone qualifies. NEVER populate applicantAddress with a web URL (http://..., www...., example.com), an email address, or a social-media handle. If the label shows only a URL/website, set applicantAddress.present=false.'
] as const;

const OCR_AUGMENTED_INSTRUCTIONS = [
  'You are an OCR structuring engine. Your ONLY job is to organize pre-extracted text into the required fields.',
  'An independent OCR engine has already extracted the visible text from this alcohol beverage label. The OCR text is provided below.',
  'Use the OCR text as your PRIMARY source for all text field values. Do not re-read characters from the image.',
  'Use the image ONLY for visual formatting signals and image quality assessment.',
  'Structure the OCR text into the typed fields and return structured output only.',
  'If the OCR text is garbled or clearly wrong for a field, set present=false with a note — do not guess.',
  'Never guess unsupported field values.',
  'Never copy label facts from application inputs or infer them from external expectations.',
  'Never compare extracted text against any "correct" or "expected" value.',
  'For every field, mark present=true only when the OCR text supports the extraction.',
  'Use confidence between 0 and 1. Base text field confidence on OCR text clarity.',
  'Assess image quality from the image itself, and set noTextDetected=true only when the OCR text is empty.',
  'For warning visual signals: report what you see but mark "uncertain" if unclear.',
  'Provide a beverageTypeHint only when the OCR text or image supports it; otherwise use unknown.',
  'Populate the structured fields exactly as named, including governmentWarning when warning text appears in the OCR output.',
  // Same disambiguation as BASELINE_INSTRUCTIONS — keep prompts in
  // sync so the OCR-augmented path doesn't leak URLs either.
  'The applicantAddress field is the NAME AND/OR POSTAL ADDRESS of the bottler, packer, or importer, as printed on the label (e.g. "Bottled by Acme Brewery, Boston, MA 02210", or "Bottled by Acme Brewery" without a street if no street is printed). A producer/bottler name alone qualifies. NEVER populate applicantAddress with a web URL (http://..., www...., example.com), an email address, or a social-media handle. If the OCR text shows only a URL/website, set applicantAddress.present=false.'
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
      return 'review';
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

export function buildOcrAugmentedExtractionPrompt(input: {
  surface: LlmEndpointSurface | ReviewPromptSurface;
  extractionMode: ExtractionMode;
  ocrText: string;
}): string {
  const surface = resolveReviewPromptSurface(input.surface);
  return [
    ...OCR_AUGMENTED_INSTRUCTIONS,
    ...ENDPOINT_OVERLAYS[surface],
    ...MODE_OVERLAYS[input.extractionMode],
    '', '--- OCR TEXT START ---', input.ocrText, '--- OCR TEXT END ---'
  ].join(' ');
}

/**
 * Verification-mode prompt. Takes the applicant-declared identifier
 * fields and asks the model to verify whether each is visible on the
 * label. For each identifier field, the model populates:
 *   - `visibleText`: the exact text as it appears on the label image
 *   - `alternativeReading`: only when a DIFFERENT value appears in the
 *     expected position (e.g. fanciful name where the brand was expected)
 * Numeric and canonical fields (ABV, net contents, warning, etc.) are
 * still extracted bottom-up.
 *
 * Returns a pair `{ preImage, postImage }` so callers can place the
 * image between the two halves:
 *
 *   [preImage text]  →  [image]  →  [postImage text]
 *
 * This gives the verification instructions + numeric re-anchor RECENCY
 * in the model's context — last thing read before the structured output
 * is "double-check the warning + numerics", which empirically helps the
 * VLM on long multimodal prompts.
 *
 * Returns `null` when there are no identifier fields to verify
 * (applicant provided none). Callers fall back to the standard prompt.
 */
export function buildVerificationExtractionPrompt(input: {
  surface: LlmEndpointSurface | ReviewPromptSurface;
  extractionMode: ExtractionMode;
  fields: NormalizedReviewFields;
  ocrText?: string;
}): { preImage: string; postImage: string } | null {
  const declared = collectDeclaredIdentifiers(input.fields);
  if (declared.length === 0) return null;

  const surface = resolveReviewPromptSurface(input.surface);
  const declaredBlock = declared.map(({ name, value }) => `  - ${name}: ${JSON.stringify(value)}`).join('\n');

  // Pre-image block: same baseline instructions as the standard path,
  // plus an OCR block when we have one. No verification text yet — we
  // let the model form its own first impression of the image.
  const baseInstructions = input.ocrText ? OCR_AUGMENTED_INSTRUCTIONS : BASELINE_INSTRUCTIONS;
  const preImage = [
    [
      ...baseInstructions,
      ...ENDPOINT_OVERLAYS[surface],
      ...MODE_OVERLAYS[input.extractionMode]
    ].join(' '),
    input.ocrText
      ? ['', '--- OCR TEXT START ---', input.ocrText, '--- OCR TEXT END ---'].join(' ')
      : ''
  ].filter(Boolean).join('');

  // Post-image block: verification instructions come AFTER the image so
  // the model has already visually scanned the label. The numeric
  // re-anchor is the LAST thing the model reads before producing JSON,
  // to counter the attention-dilution we measured on warning text.
  const postImage = [
    '',
    '--- APPLICATION-DECLARED IDENTIFIERS (for verification) ---',
    declaredBlock,
    '--- END APPLICATION DATA ---',
    '',
    'For the identifier fields above (brandName, fancifulName, classType,',
    'countryOfOrigin, applicantAddress), and ONLY these fields: decide',
    'whether each applicant-declared value is visible on the label image',
    'you just examined. If yes, set present=true and populate',
    '`visibleText` with the EXACT label text (preserve casing,',
    'punctuation, stylization). If you see a clearly DIFFERENT value in',
    'the expected position (e.g. a prominent fanciful name where the',
    'brand was expected, or a different country in the "Product of"',
    'line), populate `alternativeReading` with the label text you see.',
    'If the applicant-declared value is not visible anywhere on the',
    'label, set present=false.',
    '',
    'CRITICAL: do NOT echo the applicant string back as `visibleText`',
    'without reading the label. The label text must match what is',
    'physically visible on the image.',
    '',
    '--- NUMERIC + CANONICAL FIELDS (still extracted bottom-up) ---',
    'alcoholContent, netContents, vintage, appellation, governmentWarning',
    'are NOT subject to verification. Extract them from the label text',
    'itself — do NOT use any application data for these.',
    '',
    'Before returning, DOUBLE-CHECK that `governmentWarning.value` is',
    'transcribed character-exactly from the label, including the',
    '"(1)" / "(2)" paragraph markers, the exact wording "Surgeon',
    'General", "during pregnancy", "birth defects", "operate',
    'machinery", and ending punctuation. This field is compared',
    'strictly by the downstream checker — small wording drift causes',
    'a hard failure. Take the extra attention before returning.',
    '',
    'Also double-check `alcoholContent.value` and `netContents.value`',
    'are transcribed exactly (e.g. "5.2% Alc./Vol.", "12 FL OZ") —',
    'not normalized, not reformatted.'
  ].join('\n');

  return { preImage, postImage };
}

function collectDeclaredIdentifiers(
  fields: NormalizedReviewFields
): Array<{ name: VerificationModeIdentifierField; value: string }> {
  const out: Array<{ name: VerificationModeIdentifierField; value: string }> = [];
  if (fields.brandName) out.push({ name: 'brandName', value: fields.brandName });
  if (fields.fancifulName) out.push({ name: 'fancifulName', value: fields.fancifulName });
  if (fields.classType) out.push({ name: 'classType', value: fields.classType });
  if (fields.country) out.push({ name: 'countryOfOrigin', value: fields.country });
  if (fields.applicantAddress) out.push({ name: 'applicantAddress', value: fields.applicantAddress });
  return out;
}

/**
 * Env-flag read. Default OFF — verification mode must be explicitly
 * turned on in an environment before the prompt path is taken.
 *
 *   VERIFICATION_MODE=on      → enabled
 *   VERIFICATION_MODE=off     → disabled (default)
 *   VERIFICATION_MODE unset   → disabled
 */
export function isVerificationModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.VERIFICATION_MODE?.trim().toLowerCase();
  return raw === 'on' || raw === 'enabled' || raw === 'true' || raw === '1';
}
