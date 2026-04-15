import { randomUUID } from 'node:crypto';

import {
  reviewExtractionSchema,
  type BeverageType,
  type BeverageTypeSource,
  type ReviewError,
  type ReviewErrorKind,
  type ReviewExtraction,
  type ReviewExtractionFields,
  type ReviewExtractionImageQuality,
  type ReviewIntakeBeverage,
  type WarningVisualSignals
} from '../shared/contracts/review';
import type { ExtractionMode } from './ai-provider-policy';
import type { LlmEndpointSurface } from './llm-policy';
import type { ReviewLatencyAttempt, ReviewLatencyCapture } from './review-latency';
import type { NormalizedReviewIntake } from './review-intake';

export interface RawImageQualityAssessment {
  score: number;
  issues: string[];
  noTextDetected: boolean;
  note?: string;
}

export interface ReviewExtractionModelOutput {
  beverageTypeHint?: BeverageType;
  fields: ReviewExtractionFields;
  warningSignals: WarningVisualSignals;
  imageQuality: RawImageQualityAssessment;
  summary: string;
}

export interface ReviewBeverageResolution {
  beverageType: BeverageType;
  source: BeverageTypeSource;
}

export interface ReviewExtractorContext {
  latencyAttempt?: ReviewLatencyAttempt;
  latencyCapture?: ReviewLatencyCapture;
  surface?: LlmEndpointSurface;
  extractionMode?: ExtractionMode;
}

export type ReviewExtractor = (
  intake: NormalizedReviewIntake,
  context?: ReviewExtractorContext
) => Promise<ReviewExtraction>;

export class ReviewExtractionFailure extends Error {
  readonly status: number;
  readonly error: ReviewError;

  constructor(status: number, error: ReviewError) {
    super(error.message);
    this.name = 'ReviewExtractionFailure';
    this.status = status;
    this.error = error;
  }
}

export function createReviewExtractionFailure(input: {
  status: number;
  kind: ReviewErrorKind;
  message: string;
  retryable: boolean;
}) {
  return new ReviewExtractionFailure(input.status, {
    kind: input.kind,
    message: input.message,
    retryable: input.retryable
  });
}

export function isReviewExtractionFailure(
  error: unknown
): error is ReviewExtractionFailure {
  return error instanceof ReviewExtractionFailure;
}

const DISTILLED_SPIRITS_PATTERNS = [
  /\bwhisk(?:e)?y\b/i,
  /\bbourbon\b/i,
  /\bvodka\b/i,
  /\bgin\b/i,
  /\brum\b/i,
  /\btequila\b/i,
  /\bbrandy\b/i,
  /\bliqueur\b/i,
  /\bcordial\b/i,
  /\bspirit(?:s)?\b/i
] as const;

const MALT_BEVERAGE_PATTERNS = [
  /\bale\b/i,
  /\blager\b/i,
  /\bstout\b/i,
  /\bporter\b/i,
  /\bipa\b/i,
  /\bmalt beverage\b/i,
  /\bbeer\b/i
] as const;

const WINE_PATTERNS = [
  /\bwine\b/i,
  /\bpinot\b/i,
  /\bchardonnay\b/i,
  /\bmerlot\b/i,
  /\bcabernet\b/i,
  /\bros[ée]\b/i,
  /\bchampagne\b/i
] as const;

export function resolveReviewBeverageType(input: {
  applicationBeverageTypeHint: ReviewIntakeBeverage;
  extractedClassType?: string;
  extractedAlcoholContent?: string;
  modelBeverageTypeHint?: BeverageType;
}): ReviewBeverageResolution {
  if (input.applicationBeverageTypeHint !== 'auto') {
    return {
      beverageType: input.applicationBeverageTypeHint,
      source: 'application'
    };
  }

  const classTypeInference = inferBeverageTypeFromClassType({
    classType: input.extractedClassType,
    alcoholContent: input.extractedAlcoholContent
  });
  if (classTypeInference) {
    return {
      beverageType: classTypeInference,
      source: 'class-type'
    };
  }

  if (
    input.modelBeverageTypeHint &&
    input.modelBeverageTypeHint !== 'unknown'
  ) {
    return {
      beverageType: input.modelBeverageTypeHint,
      source: 'model-hint'
    };
  }

  return {
    beverageType: 'distilled-spirits',
    source: 'strict-fallback'
  };
}

export function normalizeImageQualityAssessment(
  input: RawImageQualityAssessment
): ReviewExtractionImageQuality {
  const score = clampScore(input.score);
  const state = determineExtractionQualityState(input);

  return {
    score,
    state,
    issues: input.issues,
    note: input.note
  };
}

export function finalizeReviewExtraction(input: {
  intake: NormalizedReviewIntake;
  model: string;
  extracted: ReviewExtractionModelOutput;
  id?: string;
}): ReviewExtraction {
  const beverageResolution = resolveReviewBeverageType({
    applicationBeverageTypeHint: input.intake.fields.beverageTypeHint,
    extractedClassType: input.extracted.fields.classType.value,
    extractedAlcoholContent: input.extracted.fields.alcoholContent.value,
    modelBeverageTypeHint: input.extracted.beverageTypeHint
  });

  return reviewExtractionSchema.parse({
    id: input.id ?? randomUUID(),
    model: input.model,
    beverageType: beverageResolution.beverageType,
    beverageTypeSource: beverageResolution.source,
    modelBeverageTypeHint: input.extracted.beverageTypeHint,
    standalone: input.intake.standalone,
    hasApplicationData: input.intake.hasApplicationData,
    noPersistence: true,
    imageQuality: normalizeImageQualityAssessment(input.extracted.imageQuality),
    warningSignals: input.extracted.warningSignals,
    fields: input.extracted.fields,
    summary: input.extracted.summary
  });
}

function inferBeverageTypeFromClassType(input: {
  classType?: string;
  alcoholContent?: string;
}): BeverageType | undefined {
  const classType = input.classType?.trim();
  if (!classType) {
    return undefined;
  }

  if (DISTILLED_SPIRITS_PATTERNS.some((pattern) => pattern.test(classType))) {
    return 'distilled-spirits';
  }

  if (MALT_BEVERAGE_PATTERNS.some((pattern) => pattern.test(classType))) {
    return 'malt-beverage';
  }

  if (WINE_PATTERNS.some((pattern) => pattern.test(classType))) {
    return 'wine';
  }

  if (/\bcider\b/i.test(classType)) {
    const abv = parseAlcoholPercent(input.alcoholContent);
    if (abv !== undefined && abv > 7) {
      return 'wine';
    }
  }

  return undefined;
}

function determineExtractionQualityState(input: RawImageQualityAssessment) {
  if (input.noTextDetected) {
    return 'no-text-extracted' as const;
  }

  if (
    clampScore(input.score) < 0.6 ||
    input.issues.some((issue) =>
      /(blur|glare|dark|rotation|rotated|cut[- ]off|obscured|small text)/i.test(
        issue
      )
    )
  ) {
    return 'low-confidence' as const;
  }

  return 'ok' as const;
}

function parseAlcoholPercent(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) {
    return undefined;
  }

  return Number(match[1]);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, value));
}
