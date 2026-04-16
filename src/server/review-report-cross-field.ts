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
      summary: 'Skipped because no application data was provided.',
      details:
        'This check needs application data to compare against. Nothing was provided, so this one was skipped.',
      confidence: 1,
      citations: DISTILLED_CITATIONS
    };
  }

  return {
    id: 'same-field-of-vision',
    label: 'Same field of vision',
    status: 'info',
    severity: 'note',
    summary: 'This check is not yet available. Please confirm by eye.',
    details:
      'Brand name, class/type, and alcohol content must all appear together on the same side of a spirits label. This version of the tool does not check that yet. Please confirm by looking at the label.',
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
      summary: 'Vintage shown but no appellation.',
      details:
        'A wine label that shows a vintage year must also show an appellation of origin. This label does not.',
      confidence: 0.94,
      citations: ['27 CFR 4.34']
    };
  }

  return {
    id: 'vintage-requires-appellation',
    label: 'Vintage requires appellation',
    status: 'pass',
    severity: 'note',
    summary: 'Vintage and appellation are both on the label.',
    details:
      'The label shows an appellation along with the vintage year, as required.',
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
      summary: 'Alcohol wording is allowed.',
      details:
        'The label uses "Alc./Vol." wording, which is allowed on beer labels.',
      confidence: 0.96,
      citations: MALT_ABV_CITATIONS
    };
  }

  return {
    id: 'abv-format-permitted',
    label: 'ABV format permitted for beverage type',
    status: 'fail',
    severity: 'major',
    summary: 'Beer labels must say "Alc./Vol.", not "ABV".',
    details:
      '27 CFR 7.65 requires beer labels to show alcohol content as a percentage in the form "5.2% Alc./Vol." The word "ABV" is not allowed.',
    confidence: 0.98,
    citations: MALT_ABV_CITATIONS
  };
}
