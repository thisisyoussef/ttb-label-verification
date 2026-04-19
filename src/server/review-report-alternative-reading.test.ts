import { describe, expect, it } from 'vitest';

import {
  reviewExtractionSchema,
  type ReviewExtraction,
  type ReviewExtractionFields
} from '../shared/contracts/review';
import { buildGovernmentWarningCheck } from './government-warning-validator';
import { buildVerificationReport } from './review-report';
import type { NormalizedReviewIntake } from './review-intake';

function presentField(value: string, confidence = 0.96) {
  return {
    present: true,
    value,
    confidence
  } as const;
}

function absentField(confidence = 0.08) {
  return {
    present: false,
    confidence
  } as const;
}

function buildIntake(
  overrides: Partial<NormalizedReviewIntake['fields']> = {}
): NormalizedReviewIntake {
  const label = {
    originalName: 'label.png',
    mimeType: 'image/png',
    bytes: 8,
    buffer: Buffer.from([1, 2, 3, 4])
  };

  return {
    label,
    labels: [label],
    fields: {
      beverageTypeHint: 'auto',
      origin: 'domestic',
      varietals: [],
      ...overrides
    },
    hasApplicationData: true,
    standalone: false
  };
}

function buildExtraction(
  overrides: {
    beverageType?: ReviewExtraction['beverageType'];
    beverageTypeSource?: ReviewExtraction['beverageTypeSource'];
    modelBeverageTypeHint?: ReviewExtraction['modelBeverageTypeHint'];
    fields?: Partial<ReviewExtractionFields>;
  } = {}
): ReviewExtraction {
  const base = reviewExtractionSchema.parse({
    id: 'extract-demo-001',
    model: 'gpt-5.4',
    beverageType: 'distilled-spirits',
    beverageTypeSource: 'class-type',
    modelBeverageTypeHint: 'distilled-spirits',
    standalone: false,
    hasApplicationData: true,
    noPersistence: true,
    imageQuality: {
      score: 0.95,
      state: 'ok',
      issues: []
    },
    warningSignals: {
      prefixAllCaps: { status: 'yes', confidence: 0.98 },
      prefixBold: { status: 'yes', confidence: 0.92 },
      continuousParagraph: { status: 'yes', confidence: 0.95 },
      separateFromOtherContent: { status: 'yes', confidence: 0.9 }
    },
    fields: {
      brandName: presentField("Stone's Throw"),
      fancifulName: absentField(),
      classType: presentField('Vodka', 0.94),
      alcoholContent: presentField('45% Alc./Vol.', 0.93),
      netContents: presentField('750 mL', 0.92),
      applicantAddress: absentField(),
      countryOfOrigin: absentField(),
      ageStatement: absentField(),
      sulfiteDeclaration: absentField(),
      appellation: absentField(),
      vintage: absentField(),
      governmentWarning: presentField(
        'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
        0.97
      ),
      varietals: []
    },
    summary: 'Structured extraction completed successfully.'
  });

  return reviewExtractionSchema.parse({
    ...base,
    ...overrides,
    fields: {
      ...base.fields,
      ...overrides.fields
    }
  });
}

describe('review report alternative-reading guardrails', () => {
  it('keeps an equivalent class/type alternativeReading as a pass', async () => {
    const intake = buildIntake({
      beverageTypeHint: 'malt-beverage',
      brandName: 'Harbor Brewing',
      classType: 'ale',
      alcoholContent: '6% Alc./Vol.',
      netContents: '12 fl oz'
    });
    const extraction = buildExtraction({
      beverageType: 'malt-beverage',
      beverageTypeSource: 'application',
      modelBeverageTypeHint: 'malt-beverage',
      fields: {
        brandName: presentField('Harbor Brewing', 0.96),
        classType: {
          present: true,
          value: 'INDIA PALE ALE',
          confidence: 0.95,
          visibleText: 'INDIA PALE ALE',
          alternativeReading: 'ale'
        },
        alcoholContent: presentField('6% Alc./Vol.', 0.93),
        netContents: presentField('12 fl oz', 0.92)
      }
    });
    const warningCheck = buildGovernmentWarningCheck(extraction);

    const report = await buildVerificationReport({
      intake,
      extraction,
      warningCheck
    });

    const classTypeCheck = report.checks.find((check) => check.id === 'class-type');

    expect(classTypeCheck?.status).toBe('pass');
    expect(classTypeCheck?.summary).toBe('Label matches the approved record.');
    expect(classTypeCheck?.comparison?.status).toBe('case-mismatch');
    expect(classTypeCheck?.comparison?.note).toContain(
      'TTB class "ale" accepts label wording "INDIA PALE ALE".'
    );
    expect(classTypeCheck?.comparison?.note).not.toContain(
      'human reviewer should take a look'
    );
  });

  it('keeps an equivalent country alternativeReading as a pass', async () => {
    const intake = buildIntake({
      brandName: "Stone's Throw",
      classType: 'Vodka',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL',
      country: 'United States'
    });
    const extraction = buildExtraction({
      fields: {
        countryOfOrigin: {
          present: true,
          value: 'USA',
          confidence: 0.91,
          visibleText: 'USA',
          alternativeReading: 'United States'
        }
      }
    });
    const warningCheck = buildGovernmentWarningCheck(extraction);

    const report = await buildVerificationReport({
      intake,
      extraction,
      warningCheck
    });

    const countryCheck = report.checks.find((check) => check.id === 'country-of-origin');

    expect(countryCheck?.status).toBe('pass');
    expect(countryCheck?.summary).toBe('Label matches the approved record.');
    expect(countryCheck?.comparison?.status).toBe('case-mismatch');
    expect(countryCheck?.comparison?.note).toBe(
      '[country-equivalent] Country of origin matches the approved record.'
    );
    expect(countryCheck?.comparison?.note).not.toContain(
      'human reviewer should take a look'
    );
  });
});
