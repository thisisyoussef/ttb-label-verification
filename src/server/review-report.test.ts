import { describe, expect, it } from 'vitest';

import {
  reviewExtractionSchema,
  type ReviewExtraction,
  type ReviewExtractionFields,
  type ReviewExtractionImageQuality,
  type WarningVisualSignals
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
  const fields = {
    beverageTypeHint: 'auto' as const,
    origin: 'domestic' as const,
    varietals: [],
    ...overrides
  };
  const hasApplicationData = Boolean(
    fields.brandName ||
      fields.fancifulName ||
      fields.classType ||
      fields.alcoholContent ||
      fields.netContents ||
      fields.applicantAddress ||
      fields.country ||
      fields.formulaId ||
      fields.appellation ||
      fields.vintage ||
      fields.varietals.length > 0
  );

  return {
    label: {
      originalName: 'label.png',
      mimeType: 'image/png',
      bytes: 8,
      buffer: Buffer.from([1, 2, 3, 4])
    },
    fields,
    hasApplicationData,
    standalone: !hasApplicationData
  };
}

function buildExtraction(
  overrides: {
    beverageType?: ReviewExtraction['beverageType'];
    beverageTypeSource?: ReviewExtraction['beverageTypeSource'];
    modelBeverageTypeHint?: ReviewExtraction['modelBeverageTypeHint'];
    standalone?: boolean;
    hasApplicationData?: boolean;
    imageQuality?: Partial<ReviewExtractionImageQuality>;
    warningSignals?: Partial<WarningVisualSignals>;
    fields?: Partial<ReviewExtractionFields>;
    summary?: string;
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
      prefixAllCaps: {
        status: 'yes',
        confidence: 0.98
      },
      prefixBold: {
        status: 'yes',
        confidence: 0.92
      },
      continuousParagraph: {
        status: 'yes',
        confidence: 0.95
      },
      separateFromOtherContent: {
        status: 'yes',
        confidence: 0.9
      }
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
    imageQuality: {
      ...base.imageQuality,
      ...overrides.imageQuality
    },
    warningSignals: {
      ...base.warningSignals,
      ...overrides.warningSignals
    },
    fields: {
      ...base.fields,
      ...overrides.fields
    }
  });
}

describe('review report builder', () => {
  it('keeps cosmetic brand differences in review while preserving submitted values', () => {
    const intake = buildIntake({
      brandName: 'STONES THROW',
      classType: 'Vodka',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL'
    });
    const extraction = buildExtraction();
    const warningCheck = buildGovernmentWarningCheck(extraction);

    const report = buildVerificationReport({
      intake,
      extraction,
      warningCheck
    });

    const brandCheck = report.checks.find((check) => check.id === 'brand-name');

    expect(brandCheck?.applicationValue).toBe('STONES THROW');
    expect(brandCheck?.extractedValue).toBe("Stone's Throw");
    // New judgment layer: apostrophe difference is a fuzzy-close brand match → review
    expect(brandCheck?.status).toBe('review');
    expect(brandCheck?.comparison?.status).toBe('value-mismatch');
    // Weighted verdict: single medium-tier brand review (1.0) < threshold (2.5) → approve
    expect(report.verdict).toBe('approve');
  });

  it('fails wine reviews when a vintage claim appears without an appellation', () => {
    const intake = buildIntake({
      beverageTypeHint: 'wine',
      brandName: 'Heritage Hill',
      classType: 'Red Wine',
      alcoholContent: '13.5% Alc./Vol.',
      netContents: '750 mL',
      vintage: '2021'
    });
    const extraction = buildExtraction({
      beverageType: 'wine',
      beverageTypeSource: 'application',
      modelBeverageTypeHint: 'wine',
      fields: {
        brandName: presentField('Heritage Hill', 0.96),
        classType: presentField('Red Wine', 0.94),
        alcoholContent: presentField('13.5% Alc./Vol.', 0.93),
        netContents: presentField('750 mL', 0.92),
        vintage: presentField('2021', 0.91),
        appellation: absentField()
      }
    });
    const warningCheck = buildGovernmentWarningCheck(extraction);

    const report = buildVerificationReport({
      intake,
      extraction,
      warningCheck
    });

    const crossFieldCheck = report.crossFieldChecks.find(
      (check: (typeof report.crossFieldChecks)[number]) =>
        check.id === 'vintage-requires-appellation'
    );

    expect(crossFieldCheck?.status).toBe('fail');
    expect(report.verdict).toBe('reject');
  });

  it('fails malt beverage reports that use forbidden ABV wording', () => {
    const intake = buildIntake({
      beverageTypeHint: 'malt-beverage',
      brandName: 'Harbor Brewing',
      classType: 'Lager',
      alcoholContent: '5.2% ABV',
      netContents: '12 fl. oz.'
    });
    const extraction = buildExtraction({
      beverageType: 'malt-beverage',
      beverageTypeSource: 'application',
      modelBeverageTypeHint: 'malt-beverage',
      fields: {
        brandName: presentField('Harbor Brewing', 0.96),
        classType: presentField('Lager', 0.95),
        alcoholContent: presentField('5.2% ABV', 0.97),
        netContents: presentField('12 fl. oz.', 0.93)
      }
    });
    const warningCheck = buildGovernmentWarningCheck(extraction);

    const report = buildVerificationReport({
      intake,
      extraction,
      warningCheck
    });

    const alcoholCheck = report.checks.find(
      (check: (typeof report.checks)[number]) => check.id === 'alcohol-content'
    );
    const formatCheck = report.crossFieldChecks.find(
      (check: (typeof report.crossFieldChecks)[number]) =>
        check.id === 'abv-format-permitted'
    );

    expect(alcoholCheck?.status).toBe('fail');
    expect(formatCheck?.status).toBe('fail');
    expect(report.verdict).toBe('reject');
  });

  it('returns the approved empty-check state when no text is extracted', () => {
    const intake = buildIntake({
      brandName: "Stone's Throw"
    });
    const extraction = buildExtraction({
      beverageType: 'unknown',
      beverageTypeSource: 'strict-fallback',
      modelBeverageTypeHint: 'unknown',
      imageQuality: {
        score: 0,
        state: 'no-text-extracted',
        issues: ['No readable text detected in the uploaded image.'],
        note: 'The system could not read enough text to produce a meaningful result.'
      },
      fields: {
        brandName: absentField(),
        classType: absentField(),
        alcoholContent: absentField(),
        netContents: absentField(),
        governmentWarning: absentField()
      }
    });
    const warningCheck = buildGovernmentWarningCheck(extraction);

    const report = buildVerificationReport({
      intake,
      extraction,
      warningCheck
    });

    expect(report.verdict).toBe('review');
    expect(report.counts).toEqual({ pass: 0, review: 0, fail: 0 });
    expect(report.checks).toEqual([]);
    expect(report.crossFieldChecks).toEqual([]);
  });

  it('passes the warning evidence through unchanged in the integrated report', () => {
    const intake = buildIntake({
      brandName: "Stone's Throw",
      classType: 'Vodka',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL'
    });
    const extraction = buildExtraction();
    const warningCheck = buildGovernmentWarningCheck(extraction);

    const report = buildVerificationReport({
      intake,
      extraction,
      warningCheck
    });

    const reportWarningCheck = report.checks.find(
      (check: (typeof report.checks)[number]) => check.id === 'government-warning'
    );

    expect(reportWarningCheck?.warning).toEqual(warningCheck.warning);
    expect(reportWarningCheck?.status).toBe(warningCheck.status);
  });

  it('keeps reject summaries explicit even in standalone mode', () => {
    const intake = buildIntake();
    const extraction = buildExtraction({
      beverageType: 'malt-beverage',
      beverageTypeSource: 'model-hint',
      modelBeverageTypeHint: 'malt-beverage',
      standalone: true,
      hasApplicationData: false,
      fields: {
        brandName: presentField('Harbor Brewing', 0.96),
        classType: presentField('Lager', 0.95),
        alcoholContent: presentField('5.2% ABV', 0.97),
        netContents: presentField('12 fl. oz.', 0.93)
      }
    });
    const warningCheck = buildGovernmentWarningCheck(extraction);

    const report = buildVerificationReport({
      intake,
      extraction,
      warningCheck
    });

    expect(report.standalone).toBe(true);
    expect(report.verdict).toBe('reject');
    expect(report.verdictSecondary).toBe('Alcohol content is the deciding check.');
    expect(report.summary).toBe('One or more required fields do not match.');
  });
});
