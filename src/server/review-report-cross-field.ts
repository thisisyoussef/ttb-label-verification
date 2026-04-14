import type { CheckReview, ReviewExtraction } from '../shared/contracts/review';
import type { NormalizedReviewIntake } from './review-intake';

const DISTILLED_CITATIONS = [
  '27 CFR 5.61 mandatory label information',
  'TTB distilled spirits same field of vision guidance'
];

const MALT_ABV_CITATIONS = [
  '27 CFR 7.65 alcohol content statement',
  'TTB malt beverage ABV format guidance'
];

export function buildCrossFieldChecks(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
}): CheckReview[] {
  const checks: CheckReview[] = [];

  if (input.extraction.beverageType === 'distilled-spirits') {
    checks.push(buildSpiritsSameFieldOfVisionCheck(input));
  }

  if (input.extraction.beverageType === 'wine') {
    const wineCheck = buildWineVintageAppellationCheck(input);
    if (wineCheck) {
      checks.push(wineCheck);
    }
  }

  if (input.extraction.beverageType === 'malt-beverage') {
    const maltCheck = buildMaltAbvFormatCheck(input);
    if (maltCheck) {
      checks.push(maltCheck);
    }
  }

  return checks;
}

function buildSpiritsSameFieldOfVisionCheck(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
}): CheckReview {
  if (input.intake.standalone) {
    return {
      id: 'same-field-of-vision',
      label: 'Same field of vision',
      status: 'info',
      severity: 'note',
      summary: 'Cross-field dependency skipped in standalone mode.',
      details:
        'Application-backed spatial checks are skipped when no application form was provided.',
      confidence: 1,
      citations: DISTILLED_CITATIONS
    };
  }

  return {
    id: 'same-field-of-vision',
    label: 'Same field of vision',
    status: 'review',
    severity: 'major',
    summary: 'Same-field-of-vision still needs human confirmation.',
    details:
      'Brand name, class/type, and alcohol content must appear in the same field of vision for distilled spirits labels. This build does not yet have spatial evidence strong enough to auto-pass or auto-fail that rule.',
    confidence: input.extraction.imageQuality.state === 'ok' ? 0.54 : 0.42,
    citations: DISTILLED_CITATIONS
  };
}

function buildWineVintageAppellationCheck(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
}): CheckReview | null {
  const hasVintageClaim = Boolean(
    input.intake.fields.vintage || input.extraction.fields.vintage.present
  );
  if (!hasVintageClaim) {
    return null;
  }

  const hasAppellation = Boolean(
    input.intake.fields.appellation || input.extraction.fields.appellation.present
  );

  if (!hasAppellation) {
    return {
      id: 'vintage-requires-appellation',
      label: 'Vintage requires appellation',
      status: 'fail',
      severity: 'major',
      summary: 'Appellation missing while vintage is present.',
      details:
        'When a vintage date is shown on a wine label, an appellation of origin must also be shown. This is a clear dependency failure.',
      confidence: 0.94,
      citations: ['27 CFR 4.34']
    };
  }

  return {
    id: 'vintage-requires-appellation',
    label: 'Vintage requires appellation',
    status: 'pass',
    severity: 'note',
    summary: 'Vintage claim is paired with an appellation.',
    details:
      'The wine label includes an appellation alongside the vintage claim, so the dependency is satisfied.',
    confidence: 0.94,
    citations: ['27 CFR 4.34']
  };
}

function buildMaltAbvFormatCheck(input: {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
}): CheckReview | null {
  const alcoholValue =
    input.extraction.fields.alcoholContent.value ?? input.intake.fields.alcoholContent;

  if (!alcoholValue) {
    return null;
  }

  if (!/\bABV\b/i.test(alcoholValue)) {
    return {
      id: 'abv-format-permitted',
      label: 'ABV format permitted for beverage type',
      status: 'pass',
      severity: 'note',
      summary: 'Alcohol statement uses permitted wording.',
      details:
        'The alcohol statement uses an "Alc./Vol." style format that is acceptable for malt beverages.',
      confidence: 0.96,
      citations: MALT_ABV_CITATIONS
    };
  }

  return {
    id: 'abv-format-permitted',
    label: 'ABV format permitted for beverage type',
    status: 'fail',
    severity: 'major',
    summary: 'Malt beverage ABV must use "Alc./Vol." wording.',
    details:
      '27 CFR 7.65 requires malt beverage alcohol statements to use a percentage-of-alcohol-by-volume form such as "5.2% Alc./Vol." The available value uses "ABV," which is not permitted.',
    confidence: 0.98,
    citations: MALT_ABV_CITATIONS
  };
}
