import { describe, expect, it } from 'vitest';

import {
  buildReviewExtractionPrompt,
  reviewExtractionModelOutputSchema
} from './review-extraction-model-output';

describe('reviewExtractionModelOutputSchema', () => {
  it('fills the default summary when the model omits it', () => {
    const payload = reviewExtractionModelOutputSchema.parse({
      beverageTypeHint: 'distilled-spirits',
      fields: {
        brandName: { present: true, value: 'Example', confidence: 0.99, note: null },
        fancifulName: { present: false, value: null, confidence: 0.2, note: null },
        classType: { present: true, value: 'Whiskey', confidence: 0.99, note: null },
        alcoholContent: { present: true, value: '40% Alc/Vol', confidence: 0.99, note: null },
        netContents: { present: true, value: '750mL', confidence: 0.99, note: null },
        applicantAddress: { present: false, value: null, confidence: 0.1, note: null },
        countryOfOrigin: { present: false, value: null, confidence: 0.1, note: null },
        ageStatement: { present: false, value: null, confidence: 0.1, note: null },
        sulfiteDeclaration: { present: false, value: null, confidence: 0.1, note: null },
        appellation: { present: false, value: null, confidence: 0.1, note: null },
        vintage: { present: false, value: null, confidence: 0.1, note: null },
        governmentWarning: { present: true, value: 'GOVERNMENT WARNING', confidence: 0.9, note: null },
        varietals: []
      },
      warningSignals: {
        prefixAllCaps: { status: 'yes', confidence: 0.9, note: null },
        prefixBold: { status: 'uncertain', confidence: 0.4, note: null },
        continuousParagraph: { status: 'yes', confidence: 0.9, note: null },
        separateFromOtherContent: { status: 'yes', confidence: 0.9, note: null }
      },
      imageQuality: {
        score: 0.95,
        issues: [],
        noTextDetected: false,
        note: null
      }
    });

    expect(payload.summary).toBe('Structured extraction completed successfully.');
  });
});

describe('buildReviewExtractionPrompt', () => {
  it('keeps the runtime prompt on the detailed accuracy-first instructions', () => {
    const prompt = buildReviewExtractionPrompt({
      surface: '/api/review',
      extractionMode: 'cloud'
    });

    expect(prompt).toContain('You observe. You do not judge.');
    expect(prompt).toContain('Never guess unsupported field values.');
    expect(prompt).toContain(
      'Never compare extracted text against any "correct" or "expected" value.'
    );
    expect(prompt).toContain('governmentWarning');
  });
});
