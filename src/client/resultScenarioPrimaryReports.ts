import type { CheckReview, UIVerificationReport } from './types';
import {
  CANONICAL_WARNING,
  CITATIONS_SPIRITS,
  CITATIONS_WARNING,
  countsFor,
  passCheck,
  perfectWarning,
  WARNING_DEFECT_EXTRACTED,
  warningDefectEvidence,
  withReportDefaults
} from './resultScenarioShared';

export function perfectSpiritReport(): UIVerificationReport {
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

export function spiritWarningErrorsReport(): UIVerificationReport {
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

export function spiritBrandCaseMismatchReport(): UIVerificationReport {
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

export function lowQualityImageReport(): UIVerificationReport {
  const checks: CheckReview[] = [
    {
      id: 'brand-name',
      label: 'Brand name',
      status: 'review',
      severity: 'minor',
      summary: 'Hard to read from this image.',
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
      summary: 'Hard to read from this image.',
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
      summary: 'Digits are hard to read from this image.',
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
        'The warning paragraph is present, but the image quality is too low to verify exact wording at this resolution.',
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
            reason: 'Inconclusive — image is too hard to read reliably.'
          },
          {
            id: 'uppercase-bold-heading',
            label: 'Warning heading is uppercase and bold',
            status: 'review',
            reason: 'Inconclusive — image is too hard to read reliably.'
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
            reason: 'Inconclusive — the image is not sharp enough to check this.'
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
    verdictSecondary: 'The image was hard to read — please review these results carefully.',
    standalone: false,
    extractionQuality: {
      globalConfidence: 0.54,
      state: 'low-confidence',
      note: 'The image quality is too low for reliable results.'
    },
    counts: countsFor(checks, crossFieldChecks),
    checks,
    crossFieldChecks,
    summary: 'Image quality was too low for a confident verdict — label stays in review.'
  });
}
