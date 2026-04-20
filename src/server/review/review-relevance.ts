import {
  reviewRelevanceResultSchema,
  type BeverageType,
  type ReviewRelevanceResult,
  type ReviewRelevanceSignals
} from '../../shared/contracts/review';
import { extractFieldsFromOcrText } from '../extractors/ocr-field-extractor';
import { type OcrPrepassResult, runOcrPrepass } from '../extractors/ocr-prepass';
import { convertPdfLabelToImage } from '../extractors/pdf-label-converter';
import type { NormalizedUploadedLabel } from './review-intake';

export type ReviewRelevanceImageInput =
  | {
      status: 'ok' | 'degraded';
      text: string;
      reason?: string;
    }
  | {
      status: 'failed';
      reason: string;
    };

const ALCOHOL_KEYWORD_PATTERNS = [
  /\b(?:alc\.?\s*\/\s*vol|alcohol|proof)\b/i,
  /\b(?:bourbon|whiskey|whisky|vodka|gin|rum|tequila|brandy|cognac|liqueur|cordial)\b/i,
  /\b(?:wine|beer|ale|lager|stout|porter|ipa|malt)\b/i,
  /\b(?:government warning|surgeon general)\b/i,
  /\b(?:bottled by|brewed by|imported by|produced by|product of|distilled in|made in)\b/i
] as const;

export async function runReviewRelevancePreflight(input: {
  labels: NormalizedUploadedLabel[];
  ocrEnabled: boolean;
  convertLabel?: (label: NormalizedUploadedLabel) => Promise<NormalizedUploadedLabel>;
  runOcr?: (label: NormalizedUploadedLabel) => Promise<OcrPrepassResult>;
}): Promise<ReviewRelevanceResult> {
  if (!input.ocrEnabled) {
    return evaluateReviewRelevance({ ocrEnabled: false, images: [] });
  }

  const convertLabel = input.convertLabel ?? convertPdfLabelToImage;
  const runOcr = input.runOcr ?? runOcrPrepass;
  const images: ReviewRelevanceImageInput[] = [];

  for (const [index, label] of input.labels.entries()) {
    try {
      const converted = await convertLabel(label);
      const ocr = await runOcr(converted);
      images.push(mapOcrResultToImageInput(ocr));
    } catch {
      images.push({
        status: 'failed',
        reason: 'ocr-prepass-error'
      });
    }

    if (index === 0 && input.labels.length > 1) {
      const partial = evaluateReviewRelevance({
        ocrEnabled: true,
        images
      });
      if (partial.decision === 'likely-label') {
        return partial;
      }
    }
  }

  return evaluateReviewRelevance({
    ocrEnabled: true,
    images
  });
}

export function evaluateReviewRelevance(input: {
  ocrEnabled: boolean;
  images: ReviewRelevanceImageInput[];
}): ReviewRelevanceResult {
  if (!input.ocrEnabled) {
    return reviewRelevanceResultSchema.parse({
      decision: 'uncertain',
      confidence: 0.52,
      summary:
        'Quick scan is unavailable on this workstation, so continue if this is the right label.',
      shouldPrefetchExtraction: false,
      continueAllowed: true,
      noPersistence: true,
      signals: emptySignals(Math.max(input.images.length, 1))
    });
  }

  const aggregated = input.images.reduce(
    (current, image) => mergeSignals(current, collectSignalsFromImage(image)),
    emptySignals(0)
  );

  const detectedBeverage = detectBeverageFromImages(input.images);
  const strongSignalCount = [
    aggregated.hasGovernmentWarning,
    aggregated.hasAlcoholContent,
    aggregated.hasNetContents,
    aggregated.hasClassType,
    Boolean(detectedBeverage)
  ].filter(Boolean).length;
  const score = computeRelevanceScore(aggregated, Boolean(detectedBeverage));
  const hasWeakReadableEvidence =
    aggregated.textLength >= 24 ||
    aggregated.alcoholKeywordHits > 0 ||
    aggregated.hasApplicantAddress ||
    aggregated.hasCountryOfOrigin;
  const hasOnlyNoTextFailures =
    input.images.length > 0 &&
    input.images.every(
      (image) => image.status === 'failed' && image.reason === 'no-text-extracted'
    );
  const hasUnavailableFailure = input.images.some(
    (image) =>
      image.status === 'failed' &&
      image.reason !== 'no-text-extracted' &&
      image.reason !== 'minimal-text-extracted'
  );

  if (aggregated.textLength === 0) {
    if (hasUnavailableFailure) {
      return reviewRelevanceResultSchema.parse({
        decision: 'uncertain',
        confidence: 0.5,
        summary:
          'Quick scan could not run cleanly, so continue if this is the right label.',
        shouldPrefetchExtraction: false,
        continueAllowed: true,
        noPersistence: true,
        signals: aggregated
      });
    }

    return reviewRelevanceResultSchema.parse({
      decision: hasOnlyNoTextFailures ? 'unlikely-label' : 'uncertain',
      confidence: hasOnlyNoTextFailures ? 0.88 : 0.58,
      summary: hasOnlyNoTextFailures
        ? 'Quick scan could not find readable label text on this upload.'
        : 'Quick scan did not find enough readable text to trust this image yet.',
      shouldPrefetchExtraction: false,
      continueAllowed: true,
      noPersistence: true,
      signals: aggregated
    });
  }

  if (
    aggregated.hasGovernmentWarning ||
    (aggregated.hasAlcoholContent && aggregated.hasNetContents) ||
    (aggregated.hasClassType &&
      (aggregated.hasAlcoholContent || aggregated.hasNetContents)) ||
    strongSignalCount >= 3
  ) {
    return reviewRelevanceResultSchema.parse({
      decision: 'likely-label',
      confidence: clamp(0.74 + score * 0.03),
      summary:
        aggregated.scannedImageCount > 1
          ? 'Quick scan found alcohol-label signals across the uploaded images.'
          : 'Quick scan found alcohol-label signals on this upload.',
      detectedBeverage,
      shouldPrefetchExtraction: true,
      continueAllowed: true,
      noPersistence: true,
      signals: aggregated
    });
  }

  if (strongSignalCount === 0 && score <= 2 && !hasWeakReadableEvidence) {
    return reviewRelevanceResultSchema.parse({
      decision: 'unlikely-label',
      confidence: 0.8,
      summary:
        'Quick scan found text, but it does not look like a readable alcohol label yet.',
      shouldPrefetchExtraction: false,
      continueAllowed: true,
      noPersistence: true,
      signals: aggregated
    });
  }

  return reviewRelevanceResultSchema.parse({
    decision: 'uncertain',
    confidence: clamp(0.55 + score * 0.02),
    summary:
      'Quick scan found some readable text, but not enough label-specific evidence to trust it yet.',
    detectedBeverage,
    shouldPrefetchExtraction: false,
    continueAllowed: true,
    noPersistence: true,
    signals: aggregated
  });
}

function mapOcrResultToImageInput(result: OcrPrepassResult): ReviewRelevanceImageInput {
  if (result.status === 'failed') {
    return {
      status: 'failed',
      reason: result.reason
    };
  }

  return {
    status: result.status,
    text: result.text,
    reason: 'reason' in result ? result.reason : undefined
  };
}

function collectSignalsFromImage(image: ReviewRelevanceImageInput): ReviewRelevanceSignals {
  if (image.status === 'failed') {
    return emptySignals(1);
  }

  const text = image.text.trim();
  if (text.length === 0) {
    return emptySignals(1);
  }

  const parsed = extractFieldsFromOcrText(text);

  return {
    scannedImageCount: 1,
    textLength: text.length,
    alcoholKeywordHits: countAlcoholKeywordHits(text),
    hasAlcoholContent:
      Boolean(parsed?.fields.alcoholContent.present) ||
      /\b(?:\d+(?:\.\d+)?\s*%\s*(?:alc\.?(?:\s*\/\s*|\s+by\s+)vol\.?|by\s+vol\.?)|\d+(?:\.\d+)?\s*proof)\b/i.test(
        text
      ),
    hasNetContents:
      Boolean(parsed?.fields.netContents.present) ||
      /\b(?:net\s+cont(?:ents?)?|\d+(?:\.\d+)?\s*(?:ml|mL|cl|l|fl\.?\s*oz\.?|pint|liter|litre))\b/i.test(
        text
      ),
    hasGovernmentWarning:
      Boolean(parsed?.fields.governmentWarning.present) ||
      /government\s*warning|surgeon\s*general/i.test(text),
    hasClassType:
      Boolean(parsed?.fields.classType.present) ||
      /\b(?:bourbon|whiskey|whisky|vodka|gin|rum|tequila|brandy|cognac|wine|beer|ale|lager|stout|porter|ipa|liqueur|cordial)\b/i.test(
        text
      ),
    hasApplicantAddress:
      Boolean(parsed?.fields.applicantAddress.present) ||
      /\b(?:bottled by|brewed by|imported by|produced by)\b/i.test(text),
    hasCountryOfOrigin:
      Boolean(parsed?.fields.countryOfOrigin.present) ||
      /\b(?:product of|produced in|distilled in|made in)\b/i.test(text)
  };
}

function mergeSignals(
  left: ReviewRelevanceSignals,
  right: ReviewRelevanceSignals
): ReviewRelevanceSignals {
  return {
    scannedImageCount: left.scannedImageCount + right.scannedImageCount,
    textLength: left.textLength + right.textLength,
    alcoholKeywordHits: left.alcoholKeywordHits + right.alcoholKeywordHits,
    hasAlcoholContent: left.hasAlcoholContent || right.hasAlcoholContent,
    hasNetContents: left.hasNetContents || right.hasNetContents,
    hasGovernmentWarning: left.hasGovernmentWarning || right.hasGovernmentWarning,
    hasClassType: left.hasClassType || right.hasClassType,
    hasApplicantAddress: left.hasApplicantAddress || right.hasApplicantAddress,
    hasCountryOfOrigin: left.hasCountryOfOrigin || right.hasCountryOfOrigin
  };
}

function detectBeverageFromImages(
  images: ReviewRelevanceImageInput[]
): BeverageType | undefined {
  for (const image of images) {
    if (image.status === 'failed') {
      continue;
    }
    const parsed = extractFieldsFromOcrText(image.text);
    if (parsed?.beverageTypeHint && parsed.beverageTypeHint !== 'unknown') {
      return parsed.beverageTypeHint;
    }
    if (/\b(?:bourbon|whiskey|whisky|vodka|gin|rum|tequila|brandy|cognac|spirits?|liqueur|cordial|proof)\b/i.test(image.text)) {
      return 'distilled-spirits';
    }
    if (/\b(?:wine|vin|vino|champagne|prosecco|cabernet|merlot|chardonnay|riesling|pinot|sauvignon|semillon)\b/i.test(image.text)) {
      return 'wine';
    }
    if (/\b(?:ale|beer|lager|stout|porter|ipa|malt|pilsner|hefeweizen|brewed)\b/i.test(image.text)) {
      return 'malt-beverage';
    }
  }

  return undefined;
}

function computeRelevanceScore(
  signals: ReviewRelevanceSignals,
  hasDetectedBeverage: boolean
) {
  let score = 0;
  if (signals.hasGovernmentWarning) score += 5;
  if (signals.hasAlcoholContent) score += 4;
  if (signals.hasNetContents) score += 3;
  if (signals.hasClassType) score += 3;
  if (hasDetectedBeverage) score += 2;
  if (signals.hasApplicantAddress) score += 1;
  if (signals.hasCountryOfOrigin) score += 1;
  if (signals.alcoholKeywordHits >= 2) score += 1;
  if (signals.textLength >= 40) score += 1;
  return score;
}

function countAlcoholKeywordHits(text: string) {
  return ALCOHOL_KEYWORD_PATTERNS.reduce(
    (count, pattern) => count + (pattern.test(text) ? 1 : 0),
    0
  );
}

function emptySignals(scannedImageCount: number): ReviewRelevanceSignals {
  return {
    scannedImageCount,
    textLength: 0,
    alcoholKeywordHits: 0,
    hasAlcoholContent: false,
    hasNetContents: false,
    hasGovernmentWarning: false,
    hasClassType: false,
    hasApplicantAddress: false,
    hasCountryOfOrigin: false
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
}
