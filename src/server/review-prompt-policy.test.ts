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
  });

  it('maps batch retry traffic onto the batch overlay and local-mode caution', () => {
    const policy = resolveReviewPromptPolicy({
      surface: '/api/batch/retry',
      extractionMode: 'local'
    });

    expect(policy.promptProfile).toBe('review-extraction/batch-local-v1');
    expect(policy.guardrailPolicy).toBe(
      'review-extraction/structural-guardrails-local-v1'
    );
    expect(policy.prompt).toContain(
      'Keep degradation item-local and concise so one weak label does not inflate session-wide noise.'
    );
    expect(policy.prompt).toContain(
      'Local mode must preserve readable text but abstain on weak formatting or spatial judgments.'
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
    expect(prompt).toContain('APPLICATION-DECLARED IDENTIFIERS');
    expect(prompt).toContain('brandName');
    expect(prompt).toContain("Stone's Throw");
    expect(prompt).toContain('classType');
    expect(prompt).toContain('countryOfOrigin');
    expect(prompt).toContain('`visibleText`');
    expect(prompt).toContain('`alternativeReading`');
    // Critical guardrail: must not let the model echo application data
    // without actually reading the label.
    expect(prompt).toContain('do NOT echo the applicant string back');
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
