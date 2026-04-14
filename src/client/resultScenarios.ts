import type {
  CheckReview,
  DiffSegment,
  UIVerificationReport,
  WarningEvidence
} from './types';

const CANONICAL_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

const CITATIONS_WARNING = ['27 CFR part 16', 'TTB health warning statement guidance'];

const CITATIONS_SPIRITS = [
  '27 CFR 5.61 mandatory label information',
  'TTB distilled spirits labeling guidance'
];

const CITATIONS_WINE = ['27 CFR 4.34 appellation and vintage', '27 CFR 4.35 class and type'];

const CITATIONS_MALT_ABV = [
  '27 CFR 7.65 alcohol content statement',
  'TTB malt beverage ABV format guidance'
];

function countsFor(checks: CheckReview[], crossField: CheckReview[]) {
  const all = [...checks, ...crossField];
  const tally = { pass: 0, review: 0, fail: 0 };
  for (const check of all) {
    if (check.status === 'pass') tally.pass += 1;
    else if (check.status === 'review') tally.review += 1;
    else if (check.status === 'fail') tally.fail += 1;
  }
  return tally;
}

function withReportDefaults(
  report: Omit<
    UIVerificationReport,
    'mode' | 'latencyBudgetMs' | 'noPersistence'
  >
): UIVerificationReport {
  return {
    mode: 'single-label',
    latencyBudgetMs: 5000,
    noPersistence: true,
    ...report
  };
}

function passCheck(
  id: string,
  label: string,
  appValue: string,
  extracted: string,
  citations: string[] = CITATIONS_SPIRITS,
  confidence = 0.97,
  summary = 'Matches the application value.',
  details = 'Application value and extracted value match exactly within normalization.'
): CheckReview {
  return {
    id,
    label,
    status: 'pass',
    severity: 'note',
    summary,
    details,
    confidence,
    citations,
    applicationValue: appValue,
    extractedValue: extracted,
    comparison: { status: 'match' }
  };
}

// -----------------------------
// Perfect spirit (approve)
// -----------------------------

const perfectWarning: WarningEvidence = {
  subChecks: [
    { id: 'present', label: 'Warning text is present', status: 'pass', reason: 'Meets this requirement.' },
    { id: 'exact-text', label: 'Warning text matches required wording', status: 'pass', reason: 'Meets this requirement.' },
    {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'pass',
      reason: 'Meets this requirement.'
    },
    {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'pass',
      reason: 'Meets this requirement.'
    },
    {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'pass',
      reason: 'Meets this requirement.'
    }
  ],
  required: CANONICAL_WARNING,
  extracted: CANONICAL_WARNING,
  segments: [{ kind: 'match', required: CANONICAL_WARNING, extracted: CANONICAL_WARNING }]
};

function perfectSpiritReport(): UIVerificationReport {
  const checks: CheckReview[] = [
    passCheck('brand-name', 'Brand name', "Stone's Throw", "Stone's Throw"),
    passCheck('fanciful-name', 'Fanciful name', 'Small Batch Reserve', 'Small Batch Reserve'),
    passCheck(
      'class-type',
      'Class / Type',
      'Kentucky Straight Bourbon Whiskey',
      'Kentucky Straight Bourbon Whiskey'
    ),
    passCheck('alcohol-content', 'Alcohol content', '45% Alc./Vol.', '45% Alc./Vol.'),
    passCheck('net-contents', 'Net contents', '750 mL', '750 mL'),
    passCheck(
      'applicant-address',
      'Applicant name & address',
      'Stone Throw Distilling Co., Louisville, KY',
      'Stone Throw Distilling Co., Louisville, KY'
    ),
    passCheck('origin', 'Origin', 'Domestic', 'Domestic'),
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'pass',
      severity: 'note',
      summary: 'Warning statement matches required wording.',
      details: 'All five sub-checks pass. The warning reads exactly as required by regulation.',
      confidence: 0.98,
      citations: CITATIONS_WARNING,
      extractedValue: CANONICAL_WARNING,
      warning: perfectWarning
    }
  ];
  const crossFieldChecks: CheckReview[] = [];
  return withReportDefaults({
    id: 'perfect-spirit-label',
    beverageType: 'distilled-spirits',
    verdict: 'approve',
    standalone: false,
    extractionQuality: { globalConfidence: 0.97, state: 'ok' },
    counts: countsFor(checks, crossFieldChecks),
    checks,
    crossFieldChecks,
    summary: 'All extracted checks pass for the baseline distilled spirits label.'
  });
}

// -----------------------------
// Spirit warning errors (reject, warning fail)
// -----------------------------

const WARNING_DEFECT_EXTRACTED =
  'Government Warning. (1) According to the surgeon general, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

const warningDefectSegments: DiffSegment[] = [
  { kind: 'wrong-case', required: 'GOVERNMENT WARNING', extracted: 'Government Warning' },
  { kind: 'wrong-character', required: ':', extracted: '.' },
  { kind: 'match', required: ' (1) According to the ', extracted: ' (1) According to the ' },
  { kind: 'wrong-case', required: 'Surgeon General', extracted: 'surgeon general' },
  {
    kind: 'match',
    required:
      ', women should not drink alcoholic beverages during pregnancy because of the risk of birth defects',
    extracted:
      ', women should not drink alcoholic beverages during pregnancy because of the risk of birth defects'
  },
  { kind: 'missing', required: '. ', extracted: ' ' },
  {
    kind: 'match',
    required:
      '(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
    extracted:
      '(2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
  }
];

const warningDefectEvidence: WarningEvidence = {
  subChecks: [
    { id: 'present', label: 'Warning text is present', status: 'pass', reason: 'Meets this requirement.' },
    {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'fail',
      reason:
        'Required wording begins with "GOVERNMENT WARNING:". Extracted text begins with "Government Warning." and omits a period + space before "(2)".'
    },
    {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'fail',
      reason: 'Heading appears in mixed case.'
    },
    {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'pass',
      reason: 'Meets this requirement.'
    },
    {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'pass',
      reason: 'Meets this requirement.'
    }
  ],
  required: CANONICAL_WARNING,
  extracted: WARNING_DEFECT_EXTRACTED,
  segments: warningDefectSegments
};

function spiritWarningErrorsReport(): UIVerificationReport {
  const checks: CheckReview[] = [
    passCheck('brand-name', 'Brand name', 'Ironwood', 'Ironwood'),
    passCheck('fanciful-name', 'Fanciful name', 'Reserve', 'Reserve'),
    passCheck('class-type', 'Class / Type', 'Vodka', 'Vodka'),
    passCheck('alcohol-content', 'Alcohol content', '40% Alc./Vol.', '40% Alc./Vol.'),
    passCheck('net-contents', 'Net contents', '1 L', '1 L'),
    passCheck(
      'applicant-address',
      'Applicant name & address',
      'Ironwood Spirits LLC, Portland, OR',
      'Ironwood Spirits LLC, Portland, OR'
    ),
    passCheck('origin', 'Origin', 'Domestic', 'Domestic'),
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'fail',
      severity: 'blocker',
      summary: 'Warning heading and punctuation do not match required wording.',
      details:
        'The warning heading appears in title case rather than uppercase, and a required period and space before "(2)" are missing. Exact wording and uppercase/bold heading are rejection-critical under 27 CFR part 16.',
      confidence: 0.94,
      citations: CITATIONS_WARNING,
      extractedValue: WARNING_DEFECT_EXTRACTED,
      warning: warningDefectEvidence
    }
  ];
  const crossFieldChecks: CheckReview[] = [];
  return withReportDefaults({
    id: 'spirit-warning-errors',
    beverageType: 'distilled-spirits',
    verdict: 'reject',
    verdictSecondary: 'Government warning is the deciding check.',
    standalone: false,
    extractionQuality: { globalConfidence: 0.94, state: 'ok' },
    counts: countsFor(checks, crossFieldChecks),
    checks,
    crossFieldChecks,
    summary:
      'Government warning defects drive a rejection-ready distilled spirits review result.'
  });
}

// -----------------------------
// Spirit brand case mismatch (review, cosmetic)
// -----------------------------

function spiritBrandCaseMismatchReport(): UIVerificationReport {
  const checks: CheckReview[] = [
    {
      id: 'brand-name',
      label: 'Brand name',
      status: 'review',
      severity: 'minor',
      summary: 'Casing difference detected.',
      details:
        'The extracted text matches the application value when compared case-insensitively. Regulatory standards typically accept mixed-case variants for brand identification, but this may warrant a human look.',
      confidence: 0.96,
      citations: ['27 CFR 5.63 brand name requirements'],
      applicationValue: "STONE'S THROW",
      extractedValue: "Stone's Throw",
      comparison: {
        status: 'case-mismatch',
        applicationValue: "STONE'S THROW",
        extractedValue: "Stone's Throw",
        note: 'Mixed case vs. uppercase'
      }
    },
    passCheck(
      'class-type',
      'Class / Type',
      'Kentucky Straight Bourbon Whiskey',
      'Kentucky Straight Bourbon Whiskey'
    ),
    passCheck('alcohol-content', 'Alcohol content', '45% Alc./Vol.', '45% Alc./Vol.'),
    passCheck('net-contents', 'Net contents', '750 mL', '750 mL'),
    passCheck(
      'applicant-address',
      'Applicant name & address',
      'Stone Throw Distilling Co., Louisville, KY',
      'Stone Throw Distilling Co., Louisville, KY'
    ),
    passCheck('origin', 'Origin', 'Domestic', 'Domestic'),
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'pass',
      severity: 'note',
      summary: 'Warning statement matches required wording.',
      details: 'All five sub-checks pass.',
      confidence: 0.97,
      citations: CITATIONS_WARNING,
      extractedValue: CANONICAL_WARNING,
      warning: perfectWarning
    }
  ];
  const crossFieldChecks: CheckReview[] = [];
  return withReportDefaults({
    id: 'spirit-brand-case-mismatch',
    beverageType: 'distilled-spirits',
    verdict: 'review',
    standalone: false,
    extractionQuality: { globalConfidence: 0.96, state: 'ok' },
    counts: countsFor(checks, crossFieldChecks),
    checks,
    crossFieldChecks,
    summary: 'Cosmetic brand mismatch keeps the distilled spirits label in review.'
  });
}

// -----------------------------
// Wine missing appellation (reject, cross-field fail)
// -----------------------------

function wineMissingAppellationReport(): UIVerificationReport {
  const checks: CheckReview[] = [
    passCheck('brand-name', 'Brand name', 'Heritage Hill', 'Heritage Hill', CITATIONS_WINE),
    passCheck('class-type', 'Class / Type', 'Red Wine', 'Red Wine', CITATIONS_WINE),
    passCheck('alcohol-content', 'Alcohol content', '13.5% Alc./Vol.', '13.5% Alc./Vol.', CITATIONS_WINE),
    passCheck('net-contents', 'Net contents', '750 mL', '750 mL', CITATIONS_WINE),
    passCheck(
      'applicant-address',
      'Applicant name & address',
      'Heritage Hill Cellars, Napa, CA',
      'Heritage Hill Cellars, Napa, CA',
      CITATIONS_WINE
    ),
    passCheck('origin', 'Origin', 'Domestic', 'Domestic', CITATIONS_WINE),
    {
      id: 'appellation',
      label: 'Appellation',
      status: 'fail',
      severity: 'blocker',
      summary: 'Appellation not detected on the label.',
      details:
        'The label shows a vintage date but no appellation of origin. For wines, when a vintage date is shown, an appellation of origin is required per 27 CFR 4.34.',
      confidence: 0.92,
      citations: CITATIONS_WINE,
      applicationValue: '',
      extractedValue: '',
      comparison: { status: 'not-applicable' }
    },
    passCheck('vintage', 'Vintage', '2021', '2021', CITATIONS_WINE),
    {
      id: 'varietals',
      label: 'Varietals',
      status: 'review',
      severity: 'minor',
      summary: 'Varietal percentages total 85%, not 100%.',
      details:
        'Two varietals declared: Cabernet Sauvignon 75% and Merlot 10%. The total does not reach 100%.',
      confidence: 0.95,
      citations: CITATIONS_WINE,
      applicationValue: 'Cabernet Sauvignon 75%, Merlot 10%',
      extractedValue: 'Cabernet Sauvignon 75%, Merlot 10%',
      comparison: { status: 'match' }
    },
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'pass',
      severity: 'note',
      summary: 'Warning statement matches required wording.',
      details: 'All five sub-checks pass.',
      confidence: 0.96,
      citations: CITATIONS_WARNING,
      extractedValue: CANONICAL_WARNING,
      warning: perfectWarning
    }
  ];
  const crossFieldChecks: CheckReview[] = [
    {
      id: 'vintage-requires-appellation',
      label: 'Vintage requires appellation',
      status: 'fail',
      severity: 'blocker',
      summary: 'Appellation missing while vintage is present.',
      details:
        'When a vintage date is shown on the label, an appellation of origin must also be shown (27 CFR 4.34). The label shows "2021" but no appellation was detected.',
      confidence: 0.94,
      citations: ['27 CFR 4.34']
    },
    {
      id: 'varietal-total',
      label: 'Varietal percentage totals 100%',
      status: 'review',
      severity: 'minor',
      summary: 'Declared varietal percentages total 85%.',
      details: 'Cabernet Sauvignon 75% + Merlot 10% = 85%. Total should reach 100% for full varietal labeling.',
      confidence: 0.95,
      citations: ['27 CFR 4.23']
    }
  ];
  return withReportDefaults({
    id: 'wine-missing-appellation',
    beverageType: 'wine',
    verdict: 'reject',
    verdictSecondary: 'Vintage requires appellation is the deciding check.',
    standalone: false,
    extractionQuality: { globalConfidence: 0.94, state: 'ok' },
    counts: countsFor(checks, crossFieldChecks),
    checks,
    crossFieldChecks,
    summary:
      'Wine review surfaces a missing appellation plus dependent cross-field failures.'
  });
}

// -----------------------------
// Beer forbidden ABV format (reject, ABV fail)
// -----------------------------

function beerForbiddenAbvFormatReport(): UIVerificationReport {
  const checks: CheckReview[] = [
    passCheck('brand-name', 'Brand name', 'Harbor Brewing', 'Harbor Brewing', CITATIONS_MALT_ABV),
    passCheck(
      'fanciful-name',
      'Fanciful name',
      'Lighthouse Lager',
      'Lighthouse Lager',
      CITATIONS_MALT_ABV
    ),
    passCheck('class-type', 'Class / Type', 'Lager', 'Lager', CITATIONS_MALT_ABV),
    {
      id: 'alcohol-content',
      label: 'Alcohol content',
      status: 'fail',
      severity: 'major',
      summary: 'ABV uses a forbidden format.',
      details:
        'Malt beverage alcohol content must be stated as a percentage of alcohol by volume — e.g., "5.2% Alc./Vol." The extracted "5.2% ABV" is not permitted.',
      confidence: 0.98,
      citations: CITATIONS_MALT_ABV,
      applicationValue: '5.2% ABV',
      extractedValue: '5.2% ABV',
      comparison: {
        status: 'value-mismatch',
        applicationValue: '5.2% ABV',
        extractedValue: '5.2% ABV',
        note: 'Format is disallowed for malt beverages'
      }
    },
    passCheck('net-contents', 'Net contents', '12 fl. oz.', '12 fl. oz.', CITATIONS_MALT_ABV),
    passCheck(
      'applicant-address',
      'Applicant name & address',
      'Harbor Brewing Co., Seattle, WA',
      'Harbor Brewing Co., Seattle, WA',
      CITATIONS_MALT_ABV
    ),
    passCheck('origin', 'Origin', 'Domestic', 'Domestic', CITATIONS_MALT_ABV),
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'pass',
      severity: 'note',
      summary: 'Warning statement matches required wording.',
      details: 'All five sub-checks pass.',
      confidence: 0.96,
      citations: CITATIONS_WARNING,
      extractedValue: CANONICAL_WARNING,
      warning: perfectWarning
    }
  ];
  const crossFieldChecks: CheckReview[] = [
    {
      id: 'abv-format-permitted',
      label: 'ABV format permitted for beverage type',
      status: 'fail',
      severity: 'major',
      summary: 'Malt beverage ABV must use "Alc./Vol." wording.',
      details:
        '27 CFR 7.65 requires malt beverage ABV to be stated as a percentage of alcohol by volume in a form such as "5.2% Alc./Vol." The extracted value uses "ABV," which is not permitted.',
      confidence: 0.98,
      citations: CITATIONS_MALT_ABV
    }
  ];
  return withReportDefaults({
    id: 'beer-forbidden-abv-format',
    beverageType: 'malt-beverage',
    verdict: 'reject',
    verdictSecondary: 'ABV format permitted for beverage type is the deciding check.',
    standalone: false,
    extractionQuality: { globalConfidence: 0.97, state: 'ok' },
    counts: countsFor(checks, crossFieldChecks),
    checks,
    crossFieldChecks,
    summary:
      'Malt beverage review captures the forbidden ABV format and dependent cross-field failure.'
  });
}

// -----------------------------
// Low quality image (review, global low confidence)
// -----------------------------

function lowQualityImageReport(): UIVerificationReport {
  const checks: CheckReview[] = [
    {
      id: 'brand-name',
      label: 'Brand name',
      status: 'review',
      severity: 'minor',
      summary: 'Low extraction confidence.',
      details: 'The image is blurry at this region. Please verify the brand name manually before approving.',
      confidence: 0.54,
      citations: CITATIONS_SPIRITS,
      applicationValue: '',
      extractedValue: 'Kentucky ???',
      comparison: { status: 'not-applicable' }
    },
    {
      id: 'class-type',
      label: 'Class / Type',
      status: 'review',
      severity: 'minor',
      summary: 'Low extraction confidence.',
      details: 'Class/type text is partially occluded.',
      confidence: 0.48,
      citations: CITATIONS_SPIRITS,
      applicationValue: '',
      extractedValue: '???',
      comparison: { status: 'not-applicable' }
    },
    {
      id: 'alcohol-content',
      label: 'Alcohol content',
      status: 'review',
      severity: 'minor',
      summary: 'Low extraction confidence on digits.',
      details: 'Could be 40% or 45%; resolution prevents a confident read.',
      confidence: 0.58,
      citations: CITATIONS_SPIRITS,
      applicationValue: '',
      extractedValue: '4?% Alc./Vol.',
      comparison: { status: 'not-applicable' }
    },
    passCheck('net-contents', 'Net contents', '', '750 mL', CITATIONS_SPIRITS, 0.88),
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'review',
      severity: 'minor',
      summary: 'Warning text detected but sub-checks are inconclusive.',
      details:
        'The warning paragraph is present, but extraction confidence is insufficient to verify exact wording at this resolution.',
      confidence: 0.62,
      citations: CITATIONS_WARNING,
      extractedValue: CANONICAL_WARNING,
      warning: {
        subChecks: [
          {
            id: 'present',
            label: 'Warning text is present',
            status: 'pass',
            reason: 'Meets this requirement.'
          },
          {
            id: 'exact-text',
            label: 'Warning text matches required wording',
            status: 'review',
            reason: 'Inconclusive — extraction confidence is low.'
          },
          {
            id: 'uppercase-bold-heading',
            label: 'Warning heading is uppercase and bold',
            status: 'review',
            reason: 'Inconclusive — extraction confidence is low.'
          },
          {
            id: 'continuous-paragraph',
            label: 'Warning is a continuous paragraph',
            status: 'pass',
            reason: 'Meets this requirement.'
          },
          {
            id: 'legibility',
            label: 'Warning is legible at label size',
            status: 'review',
            reason: 'Inconclusive — image is below resolution threshold.'
          }
        ],
        required: CANONICAL_WARNING,
        extracted: CANONICAL_WARNING,
        segments: [{ kind: 'match', required: CANONICAL_WARNING, extracted: CANONICAL_WARNING }]
      }
    }
  ];
  const crossFieldChecks: CheckReview[] = [];
  return withReportDefaults({
    id: 'low-quality-image',
    beverageType: 'unknown',
    verdict: 'review',
    verdictSecondary: 'Low extraction confidence — review carefully.',
    standalone: false,
    extractionQuality: {
      globalConfidence: 0.54,
      state: 'low-confidence',
      note: 'Image quality is below the threshold required for a confident verdict.'
    },
    counts: countsFor(checks, crossFieldChecks),
    checks,
    crossFieldChecks,
    summary: 'Low-confidence extraction keeps the label in review.'
  });
}

// -----------------------------
// Standalone demo (perfect spirit, no app data)
// -----------------------------

function standaloneDemoReport(): UIVerificationReport {
  const checks: CheckReview[] = [
    {
      id: 'brand-name',
      label: 'Brand name',
      status: 'pass',
      severity: 'note',
      summary: 'Format valid.',
      details: 'Extracted text matches an expected brand-name shape.',
      confidence: 0.97,
      citations: CITATIONS_SPIRITS,
      extractedValue: "Stone's Throw"
    },
    {
      id: 'class-type',
      label: 'Class / Type',
      status: 'pass',
      severity: 'note',
      summary: 'Format valid.',
      details: 'Class/type present with permitted wording.',
      confidence: 0.96,
      citations: CITATIONS_SPIRITS,
      extractedValue: 'Kentucky Straight Bourbon Whiskey'
    },
    {
      id: 'alcohol-content',
      label: 'Alcohol content',
      status: 'pass',
      severity: 'note',
      summary: 'Format valid.',
      details: 'ABV declared using permitted "Alc./Vol." form.',
      confidence: 0.98,
      citations: CITATIONS_SPIRITS,
      extractedValue: '45% Alc./Vol.'
    },
    {
      id: 'net-contents',
      label: 'Net contents',
      status: 'pass',
      severity: 'note',
      summary: 'Format valid.',
      details: 'Net contents present in a permitted metric form.',
      confidence: 0.97,
      citations: CITATIONS_SPIRITS,
      extractedValue: '750 mL'
    },
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'pass',
      severity: 'note',
      summary: 'Warning statement matches required wording.',
      details: 'All five sub-checks pass.',
      confidence: 0.97,
      citations: CITATIONS_WARNING,
      extractedValue: CANONICAL_WARNING,
      warning: perfectWarning
    }
  ];
  const crossFieldChecks: CheckReview[] = [
    {
      id: 'standalone-application-dependent-skipped',
      label: 'Checks requiring application data',
      status: 'info',
      severity: 'note',
      summary: 'Skipped in standalone mode.',
      details:
        'Cross-field checks that compare application data to extracted values did not run in standalone mode. Use Run Full Comparison to include them.',
      confidence: 1,
      citations: []
    }
  ];
  return withReportDefaults({
    id: 'standalone-demo',
    beverageType: 'distilled-spirits',
    verdict: 'review',
    verdictSecondary: 'Standalone review — comparison checks were not run.',
    standalone: true,
    extractionQuality: { globalConfidence: 0.97, state: 'ok' },
    counts: countsFor(checks, crossFieldChecks),
    checks,
    crossFieldChecks,
    summary:
      'Standalone review preserves extracted evidence while skipping application comparisons.'
  });
}

// -----------------------------
// No-text-extracted demo
// -----------------------------

function noTextExtractedReport(): UIVerificationReport {
  return withReportDefaults({
    id: 'no-text-extracted',
    beverageType: 'unknown',
    verdict: 'review',
    standalone: false,
    extractionQuality: {
      globalConfidence: 0,
      state: 'no-text-extracted',
      note: 'The system could not read enough text to produce a meaningful result.'
    },
    counts: { pass: 0, review: 0, fail: 0 },
    checks: [],
    crossFieldChecks: [],
    summary: 'No text could be extracted from the submitted label image.'
  });
}

const REPORT_FACTORIES: Record<string, () => UIVerificationReport> = {
  blank: perfectSpiritReport,
  'perfect-spirit-label': perfectSpiritReport,
  'spirit-warning-errors': spiritWarningErrorsReport,
  'spirit-brand-case-mismatch': spiritBrandCaseMismatchReport,
  'wine-missing-appellation': wineMissingAppellationReport,
  'beer-forbidden-abv-format': beerForbiddenAbvFormatReport,
  'low-quality-image': lowQualityImageReport
};

export function buildReportForScenario(scenarioId: string): UIVerificationReport {
  const factory = REPORT_FACTORIES[scenarioId] ?? perfectSpiritReport;
  return factory();
}

export function buildStandaloneReport(): UIVerificationReport {
  return standaloneDemoReport();
}

export function buildNoTextReport(): UIVerificationReport {
  return noTextExtractedReport();
}
