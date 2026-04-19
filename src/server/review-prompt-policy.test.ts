import { describe, expect, it } from 'vitest';

import {
  buildReviewExtractionPrompt,
  buildVerificationExtractionPrompt,
  isVerificationModeEnabled,
  resolveReviewPromptPolicy
} from './review-prompt-policy';
import type { NormalizedReviewFields } from './review-intake';

function buildFields(
  overrides: Partial<NormalizedReviewFields> = {}
): NormalizedReviewFields {
  return {
    beverageTypeHint: 'auto',
    origin: 'domestic',
    varietals: [],
    ...overrides
  };
}

describe('review prompt policy', () => {
  it('keeps the shared extraction baseline guardrails in every prompt', () => {
    const policy = resolveReviewPromptPolicy({
      surface: '/api/review',
      extractionMode: 'cloud'
    });

    expect(policy.promptProfile).toBe('review-extraction/review-cloud-v1');
    expect(policy.guardrailPolicy).toBe(
      'review-extraction/structural-guardrails-cloud-v1'
    );
    expect(policy.prompt).toContain('You observe. You do not judge.');
    expect(policy.prompt).toContain('Never make a final compliance judgment.');
    expect(policy.prompt).toContain('Never guess unsupported field values.');
    expect(policy.prompt).toContain(
      'Never copy label facts from application inputs or infer them from external expectations.'
    );
    expect(policy.prompt).toContain(
      'Do not silently omit low-confidence ambiguity. Preserve it with confidence and notes.'
    );
  });

  it('adds a warning-focused overlay for warning-sensitive routes', () => {
    const policy = resolveReviewPromptPolicy({
      surface: '/api/review/warning',
      extractionMode: 'cloud'
    });

    expect(policy.promptProfile).toBe('review-extraction/warning-cloud-v1');
    expect(policy.prompt).toContain(
      'Prioritize exact government warning text, punctuation, and warning visual signals.'
    );
    expect(policy.prompt).toContain(
      'If warning evidence is weak, say so explicitly instead of upgrading it into certainty.'
    );
    expect(policy.prompt).toContain(
      'For the opening "GOVERNMENT WARNING" heading only, compare boldness against the words immediately after it.'
    );
  });

  it('routes batch traffic through the same review overlay and local-mode caution', () => {
    const policy = resolveReviewPromptPolicy({
      surface: '/api/batch/retry',
      extractionMode: 'local'
    });

    expect(policy.promptProfile).toBe('review-extraction/review-local-v1');
    expect(policy.guardrailPolicy).toBe(
      'review-extraction/structural-guardrails-local-v1'
    );
    expect(policy.prompt).toContain(
      'Optimize for balanced extraction that preserves reviewer trust for downstream deterministic comparison.'
    );
    expect(policy.prompt).toContain(
      'Local mode must preserve readable text but abstain on weak formatting or spatial judgments.'
    );
    expect(policy.prompt).not.toContain(
      'Keep degradation item-local and concise so one weak label does not inflate session-wide noise.'
    );
  });

  it('builds prompts directly from the resolved policy', () => {
    const policy = resolveReviewPromptPolicy({
      surface: '/api/review/extraction',
      extractionMode: 'cloud'
    });

    expect(
      buildReviewExtractionPrompt({
        surface: '/api/review/extraction',
        extractionMode: 'cloud'
      })
    ).toBe(policy.prompt);
  });
});

describe('verification-mode prompt', () => {
  it('returns null when no identifier fields are declared', () => {
    const prompt = buildVerificationExtractionPrompt({
      surface: '/api/review',
      extractionMode: 'cloud',
      fields: buildFields()
    });
    expect(prompt).toBeNull();
  });

  it('adds a declared-identifiers block + verification instructions when applicant data is present', () => {
    const prompt = buildVerificationExtractionPrompt({
      surface: '/api/review',
      extractionMode: 'cloud',
      fields: buildFields({
        brandName: "Stone's Throw",
        classType: 'Vodka',
        country: 'USA'
      })
    });

    expect(prompt).not.toBeNull();
    // Standard baseline instructions belong to the pre-image text so
    // the model has them before visually scanning the label.
    expect(prompt!.preImage).toContain('You observe. You do not judge.');
    // Identifier + re-anchor blocks go AFTER the image so they're
    // the most recent context before the JSON output.
    expect(prompt!.postImage).toContain('APPLICATION-DECLARED IDENTIFIERS');
    expect(prompt!.postImage).toContain('brandName');
    expect(prompt!.postImage).toContain("Stone's Throw");
    expect(prompt!.postImage).toContain('classType');
    expect(prompt!.postImage).toContain('countryOfOrigin');
    expect(prompt!.postImage).toContain('`visibleText`');
    expect(prompt!.postImage).toContain('`alternativeReading`');
    expect(prompt!.postImage).toContain('do NOT echo the applicant string back');
    // Numeric re-anchor is the most important recency signal — counters
    // the warning-text regression seen in the first verification-mode
    // eval run.
    expect(prompt!.postImage).toContain('DOUBLE-CHECK');
    expect(prompt!.postImage).toContain('governmentWarning.value');
    expect(prompt!.postImage).toContain('alcoholContent.value');
    expect(prompt!.postImage).toContain('netContents.value');
  });

  it('honors VERIFICATION_MODE env flag parsing', () => {
    expect(isVerificationModeEnabled({ VERIFICATION_MODE: 'on' })).toBe(true);
    expect(isVerificationModeEnabled({ VERIFICATION_MODE: 'enabled' })).toBe(true);
    expect(isVerificationModeEnabled({ VERIFICATION_MODE: 'true' })).toBe(true);
    expect(isVerificationModeEnabled({ VERIFICATION_MODE: '1' })).toBe(true);
    expect(isVerificationModeEnabled({ VERIFICATION_MODE: 'off' })).toBe(false);
    expect(isVerificationModeEnabled({ VERIFICATION_MODE: '' })).toBe(false);
    expect(isVerificationModeEnabled({})).toBe(false);
  });
});
