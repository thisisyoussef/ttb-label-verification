import { describe, expect, it } from 'vitest';

import {
  buildReviewExtractionPrompt,
  resolveReviewPromptPolicy
} from './review-prompt-policy';

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
