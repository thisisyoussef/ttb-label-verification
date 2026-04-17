import {
  CANONICAL_WARNING_TEXT,
  absentModelField,
  buildRawReviewModelOutput,
  buildReviewFormFields,
  buildWarningSignal,
  presentModelField
} from '../../../src/server/testing/llm-fixture-builders';
import {
  assertGoldenCasesExist,
  goldenCaseTitle,
  goldenSliceCaseIds
} from './golden-manifest';
import type {
  ExtractionEndpointCase,
  ReviewEndpointCase,
  WarningEndpointCase
} from './case-types';

function title(caseId: string) {
  return goldenCaseTitle(caseId);
}

export const reviewEndpointCases: ReviewEndpointCase[] = [
  {
    caseId: 'G-02',
    title: title('G-02'),
    labelFilename: 'review-warning-fail.png',
    byteSignature: '02',
    personas: ['Sarah', 'Jenny', 'Marcus'],
    personaObservation:
      'Review route must reject a clear warning defect without dropping privacy-safe provenance.',
    fields: buildReviewFormFields({
      brandName: 'Trace Reserve',
      classType: 'Vodka',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL'
    }),
    modelOutput: buildRawReviewModelOutput({
      fields: {
        brandName: presentModelField('Trace Reserve'),
        governmentWarning: presentModelField(
          'Government Warning. (1) According to the surgeon general, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
          0.96
        )
      },
      warningSignals: {
        prefixAllCaps: buildWarningSignal('no', 0.97)
      }
    }),
    expected: {
      verdict: 'reject',
      summaryIncludes: 'deterministic checks failed',
      failCheckIds: ['government-warning']
    }
  },
  {
    caseId: 'G-03',
    title: title('G-03'),
    labelFilename: 'review-case-mismatch.png',
    byteSignature: '03',
    personas: ['Dave', 'Marcus'],
    personaObservation:
      'Cosmetic brand differences (casing only) auto-approve — per TTB guidance brand names display in varying case on labels. Regression guard: this must NEVER hard-reject.',
    fields: buildReviewFormFields({
      brandName: 'Trace Brand',
      classType: 'Vodka',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL'
    }),
    modelOutput: buildRawReviewModelOutput({
      fields: {
        brandName: presentModelField('TRACE BRAND')
      }
    }),
    expected: {
      // Case-only brand difference now auto-approves via judgeBrandName's
      // "brand-case-only" rule (eliminates a false-reject failure mode that
      // wasted human review time on cosmetic variations).
      verdict: 'approve',
      summaryIncludes: ''
    }
  },
  {
    caseId: 'G-04',
    title: title('G-04'),
    labelFilename: 'review-wine-vintage.png',
    byteSignature: '04',
    personas: ['Jenny', 'Marcus'],
    personaObservation:
      'Wine dependency failures must show up as deterministic rejects when vintage is present without appellation.',
    fields: buildReviewFormFields({
      brandName: 'Heritage Hill',
      classType: 'Red Wine',
      alcoholContent: '13.5% Alc./Vol.',
      netContents: '750 mL',
      vintage: '2021'
    }),
    modelOutput: buildRawReviewModelOutput({
      beverageTypeHint: 'wine',
      fields: {
        brandName: presentModelField('Heritage Hill'),
        classType: presentModelField('Red Wine'),
        alcoholContent: presentModelField('13.5% Alc./Vol.'),
        netContents: presentModelField('750 mL'),
        vintage: presentModelField('2021')
      }
    }),
    expected: {
      verdict: 'reject',
      summaryIncludes: 'deterministic checks failed',
      failCheckIds: ['vintage-requires-appellation']
    }
  },
  {
    caseId: 'G-05',
    title: title('G-05'),
    labelFilename: 'review-beer-abv.png',
    byteSignature: '05',
    personas: ['Dave', 'Jenny', 'Marcus'],
    personaObservation:
      'Malt-beverage ABV wording must fail consistently on the integrated review surface.',
    fields: buildReviewFormFields({
      brandName: 'Night Shift IPA',
      classType: 'India Pale Ale',
      alcoholContent: '5.2% ABV',
      netContents: '12 fl oz'
    }),
    modelOutput: buildRawReviewModelOutput({
      beverageTypeHint: 'malt-beverage',
      fields: {
        brandName: presentModelField('Night Shift IPA'),
        classType: presentModelField('India Pale Ale'),
        alcoholContent: presentModelField('5.2% ABV'),
        netContents: presentModelField('12 fl oz')
      }
    }),
    expected: {
      verdict: 'reject',
      summaryIncludes: 'deterministic checks failed',
      failCheckIds: ['alcohol-content', 'abv-format-permitted']
    }
  },
  {
    caseId: 'G-06',
    title: title('G-06'),
    labelFilename: 'review-low-quality.png',
    byteSignature: '06',
    personas: ['Sarah', 'Jenny', 'Marcus'],
    personaObservation:
      'Low-confidence images must degrade to review with visible caution instead of over-approving.',
    fields: buildReviewFormFields({
      brandName: 'North Ridge',
      classType: 'Vodka',
      alcoholContent: '40% Alc./Vol.',
      netContents: '1 L'
    }),
    modelOutput: buildRawReviewModelOutput({
      fields: {
        brandName: presentModelField('North Ridge', 0.72),
        classType: presentModelField('Vodka', 0.71),
        alcoholContent: presentModelField('40% Alc./Vol.', 0.7),
        netContents: presentModelField('1 L', 0.69),
        governmentWarning: presentModelField(CANONICAL_WARNING_TEXT, 0.73)
      },
      warningSignals: {
        prefixBold: buildWarningSignal('uncertain', 0.43),
        separateFromOtherContent: buildWarningSignal('uncertain', 0.45)
      },
      imageQuality: {
        score: 0.42,
        issues: ['Bottle glare across small text'],
        noTextDetected: false,
        note: 'Bottle glare across small text'
      }
    }),
    expected: {
      verdict: 'review',
      summaryIncludes: 'Low-confidence extraction keeps the label in review',
      // same-field-of-vision is now 'info' (non-blocking) until spatial
      // analysis is wired — it should not appear in reviewCheckIds.
      reviewCheckIds: ['government-warning'],
      extractionState: 'low-confidence'
    }
  },
  {
    caseId: 'G-32',
    title: title('G-32'),
    labelFilename: 'review-standalone.png',
    byteSignature: '20',
    personas: ['Sarah', 'Jenny', 'Marcus'],
    personaObservation:
      'Standalone mode must preserve extracted evidence without pretending comparison checks ran.',
    fields: null,
    modelOutput: buildRawReviewModelOutput({
      fields: {
        brandName: presentModelField('Standalone Reserve'),
        classType: presentModelField('Vodka'),
        alcoholContent: presentModelField('45% Alc./Vol.'),
        netContents: presentModelField('750 mL')
      }
    }),
    expected: {
      verdict: 'review',
      summaryIncludes: 'Standalone review preserves extracted evidence',
      standalone: true
    }
  }
];

export const extractionEndpointCases: ExtractionEndpointCase[] = [
  {
    caseId: 'G-01',
    title: title('G-01'),
    labelFilename: 'extract-happy.png',
    byteSignature: '01',
    personas: ['Jenny', 'Marcus'],
    personaObservation:
      'Extraction route should surface complete structured evidence with privacy-safe provenance for a clear label.',
    fields: buildReviewFormFields({
      brandName: 'Trace Brand',
      classType: 'Vodka',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL'
    }),
    modelOutput: buildRawReviewModelOutput(),
    expected: {
      beverageType: 'distilled-spirits',
      beverageTypeSource: 'class-type',
      standalone: false,
      hasApplicationData: true,
      imageQualityState: 'ok',
      presentFieldIds: [
        'alcoholContent',
        'brandName',
        'classType',
        'governmentWarning',
        'netContents'
      ]
    }
  },
  {
    caseId: 'G-06',
    title: title('G-06'),
    labelFilename: 'extract-low-quality.png',
    byteSignature: '16',
    personas: ['Jenny', 'Marcus'],
    personaObservation:
      'Extraction route should preserve uncertainty instead of manufacturing high-confidence values.',
    fields: buildReviewFormFields({
      brandName: 'North Ridge',
      classType: 'Vodka',
      alcoholContent: '40% Alc./Vol.',
      netContents: '1 L'
    }),
    modelOutput: reviewEndpointCases[4].modelOutput,
    expected: {
      beverageType: 'distilled-spirits',
      beverageTypeSource: 'class-type',
      standalone: false,
      hasApplicationData: true,
      imageQualityState: 'low-confidence',
      presentFieldIds: [
        'alcoholContent',
        'brandName',
        'classType',
        'governmentWarning',
        'netContents'
      ]
    }
  },
  {
    caseId: 'G-32',
    title: title('G-32'),
    labelFilename: 'extract-standalone.png',
    byteSignature: '21',
    personas: ['Sarah', 'Jenny', 'Marcus'],
    personaObservation:
      'Standalone extraction must clearly mark that no application data was present.',
    fields: null,
    modelOutput: reviewEndpointCases[5].modelOutput,
    expected: {
      beverageType: 'distilled-spirits',
      beverageTypeSource: 'class-type',
      standalone: true,
      hasApplicationData: false,
      imageQualityState: 'ok',
      presentFieldIds: [
        'alcoholContent',
        'brandName',
        'classType',
        'governmentWarning',
        'netContents'
      ]
    }
  },
  {
    caseId: 'G-39',
    title: title('G-39'),
    labelFilename: 'extract-no-text.png',
    byteSignature: '27',
    personas: ['Jenny', 'Marcus'],
    personaObservation:
      'Unreadable labels must fall back safely and report the no-text state rather than hallucinating fields.',
    fields: buildReviewFormFields(),
    modelOutput: buildRawReviewModelOutput({
      beverageTypeHint: null,
      fields: {
        brandName: absentModelField(0.12),
        classType: absentModelField(0.12),
        alcoholContent: absentModelField(0.1),
        netContents: absentModelField(0.1),
        governmentWarning: absentModelField(0.08)
      },
      imageQuality: {
        score: 0.12,
        issues: ['No readable text detected'],
        noTextDetected: true,
        note: 'No readable text detected'
      }
    }),
    expected: {
      beverageType: 'distilled-spirits',
      beverageTypeSource: 'strict-fallback',
      standalone: true,
      hasApplicationData: false,
      imageQualityState: 'no-text-extracted',
      presentFieldIds: []
    }
  }
];

export const warningEndpointCases: WarningEndpointCase[] = [
  {
    caseId: 'G-01',
    title: title('G-01'),
    labelFilename: 'warning-pass.png',
    byteSignature: '11',
    personas: ['Sarah', 'Jenny', 'Marcus'],
    personaObservation:
      'Warning-only route should clearly pass the canonical warning without requiring full review flow.',
    fields: null,
    modelOutput: buildRawReviewModelOutput(),
    expected: {
      status: 'pass',
      subChecks: {
        present: 'pass',
        'exact-text': 'pass',
        'uppercase-bold-heading': 'pass',
        'continuous-paragraph': 'pass',
        legibility: 'pass'
      }
    }
  },
  {
    caseId: 'G-02',
    title: title('G-02'),
    labelFilename: 'warning-fail.png',
    byteSignature: '12',
    personas: ['Sarah', 'Jenny', 'Marcus'],
    personaObservation:
      'Warning-only route must fail wording and heading defects without ambiguity.',
    fields: null,
    modelOutput: reviewEndpointCases[0].modelOutput,
    // G-02 fixture body text (case + period drift from canonical) is now
    // covered by the fuzzy exact-text check — case-folded Levenshtein
    // similarity is ~99%, so exact-text passes. The regulatory defect
    // remains caught: "Government Warning." (mixed case, not all-caps)
    // fails uppercase-bold-heading, which drives the overall fail
    // verdict. This matches 27 CFR 16.22's separation of heading
    // conspicuousness from body wording.
    expected: {
      status: 'fail',
      subChecks: {
        'exact-text': 'pass',
        'uppercase-bold-heading': 'fail'
      }
    }
  },
  {
    caseId: 'G-06',
    title: title('G-06'),
    labelFilename: 'warning-review.png',
    byteSignature: '13',
    personas: ['Sarah', 'Jenny', 'Marcus'],
    personaObservation:
      'Low-confidence warning reads should stay review-only on the focused warning surface.',
    fields: null,
    modelOutput: reviewEndpointCases[4].modelOutput,
    expected: {
      status: 'review',
      subChecks: {
        'exact-text': 'review',
        'uppercase-bold-heading': 'review',
        legibility: 'review'
      }
    }
  },
  {
    caseId: 'G-29',
    title: title('G-29'),
    labelFilename: 'warning-paragraph-fail.png',
    byteSignature: '14',
    personas: ['Jenny', 'Marcus'],
    personaObservation:
      'Paragraph continuity regressions must be isolated on the warning route.',
    fields: null,
    modelOutput: buildRawReviewModelOutput({
      warningSignals: {
        continuousParagraph: buildWarningSignal('no', 0.96)
      }
    }),
    expected: {
      status: 'fail',
      subChecks: {
        'continuous-paragraph': 'fail'
      }
    }
  },
  {
    caseId: 'G-31',
    title: title('G-31'),
    labelFilename: 'warning-legibility-fail.png',
    byteSignature: '15',
    personas: ['Jenny', 'Marcus'],
    personaObservation:
      'Legibility and separation failures must produce a focused fail instead of a generic review.',
    fields: null,
    modelOutput: buildRawReviewModelOutput({
      warningSignals: {
        separateFromOtherContent: buildWarningSignal('no', 0.95)
      }
    }),
    expected: {
      status: 'fail',
      subChecks: {
        legibility: 'fail'
      }
    }
  }
];

assertGoldenCasesExist([
  ...reviewEndpointCases.map((entry) => entry.caseId),
  ...extractionEndpointCases.map((entry) => entry.caseId),
  ...warningEndpointCases.map((entry) => entry.caseId)
]);

['endpoint-review', 'endpoint-extraction', 'endpoint-warning'].forEach(
  (sliceId) => {
    goldenSliceCaseIds(sliceId);
  }
);
