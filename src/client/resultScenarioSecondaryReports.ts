import type { CheckReview, UIVerificationReport } from './types';
import {
  CANONICAL_WARNING,
  CITATIONS_MALT_ABV,
  CITATIONS_SPIRITS,
  CITATIONS_WARNING,
  CITATIONS_WINE,
  countsFor,
  passCheck,
  perfectWarning,
  withReportDefaults
} from './resultScenarioShared';

export function wineMissingAppellationReport(): UIVerificationReport {
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

export function beerForbiddenAbvFormatReport(): UIVerificationReport {
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

export function standaloneDemoReport(): UIVerificationReport {
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

export function noTextExtractedReport(): UIVerificationReport {
  return withReportDefaults({
    id: 'no-text-extracted',
    beverageType: 'unknown',
    verdict: 'review',
    standalone: false,
    extractionQuality: {
      globalConfidence: 0,
      state: 'no-text-extracted',
      note: 'We could not read enough text from this image to produce a meaningful result.'
    },
    counts: { pass: 0, review: 0, fail: 0 },
    checks: [],
    crossFieldChecks: [],
    summary: 'We could not read any text from this label image.'
  });
}
