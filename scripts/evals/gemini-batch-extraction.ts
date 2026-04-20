import { buildGeminiReviewExtractionRequest, type GeminiReviewExtractionConfig } from '../../src/server/extractors/gemini-review-extractor';
import {
  normalizeReviewExtractionModelOutput,
  reviewExtractionModelOutputSchema
} from '../../src/server/extractors/review-extraction-model-output';
import type { ReviewExtractionModelOutput } from '../../src/server/extractors/review-extraction';
import type {
  NormalizedReviewFields,
  NormalizedReviewIntake,
  NormalizedUploadedLabel
} from '../../src/server/review/review-intake';

export const INLINE_BATCH_MAX_BYTES = 19 * 1024 * 1024;

export type LoadedGeminiBatchCase = {
  id: string;
  title: string;
  source: string;
  beverageType: string;
  expectedRecommendation: string;
  label: NormalizedUploadedLabel;
  fields: NormalizedReviewFields;
  hasApplicationData: boolean;
  standalone: boolean;
  expectedFields: {
    brandName: string;
    fancifulName: string;
    classType: string;
    alcoholContent: string;
    netContents: string;
    appellation: string;
    vintage: string;
  };
};

export type GeminiBatchInlineRequest = {
  contents: ReturnType<typeof buildGeminiReviewExtractionRequest>['contents'];
  config: ReturnType<typeof buildGeminiReviewExtractionRequest>['config'];
  metadata: Record<string, string>;
};

export type BatchFieldComparison =
  | 'exact'
  | 'cosmetic'
  | 'mismatch'
  | 'missing'
  | 'not-applicable';

export type BatchFieldScore = {
  expected: string;
  present: boolean;
  extracted: string | null;
  comparison: BatchFieldComparison;
  confidence: number;
  note: string | null;
};

export type BatchFieldMetrics = {
  total: number;
  present: number;
  exact: number;
  cosmetic: number;
  mismatch: number;
  missing: number;
};

export type ParsedGeminiBatchCaseResult =
  | {
      caseId: string;
      title: string;
      status: 'success';
      output: ReviewExtractionModelOutput;
      fieldScores: Record<keyof LoadedGeminiBatchCase['expectedFields'], BatchFieldScore>;
    }
  | {
      caseId: string;
      title: string;
      status: 'request-error' | 'parse-error' | 'schema-error';
      message: string;
      rawText?: string;
    };

export type GeminiBatchInlineResponse = {
  metadata?: Record<string, string>;
  response?: {
    text?: string;
  };
  error?: {
    message?: string;
    code?: number;
  };
};

export function buildGeminiBatchInlineRequests(input: {
  cases: LoadedGeminiBatchCase[];
  config: GeminiReviewExtractionConfig;
  maxBytes?: number;
}) {
  const requests = input.cases.map((caseItem) => {
    const request = buildGeminiReviewExtractionRequest({
      intake: createIntake(caseItem),
      config: input.config,
      context: {
        surface: '/api/review/extraction',
        extractionMode: 'cloud'
      }
    });

    return {
      contents: request.contents,
      config: request.config,
      metadata: {
        caseId: caseItem.id,
        source: caseItem.source,
        title: caseItem.title
      }
    } satisfies GeminiBatchInlineRequest;
  });

  const estimatedBytes = estimateInlineBatchBytes({
    model: input.config.visionModel,
    requests
  });
  const maxBytes = input.maxBytes ?? INLINE_BATCH_MAX_BYTES;
  if (estimatedBytes > maxBytes) {
    throw new Error(
      `Inline batch payload estimated at ${estimatedBytes} bytes, which exceeds the ${maxBytes} byte inline batch payload ceiling.`
    );
  }

  return {
    requests,
    estimatedBytes
  };
}

export function estimateInlineBatchBytes(input: {
  model: string;
  requests: GeminiBatchInlineRequest[];
}) {
  return Buffer.byteLength(
    JSON.stringify({
      model: input.model,
      src: input.requests
    }),
    'utf8'
  );
}

export function parseGeminiBatchExtractionResponses(input: {
  cases: LoadedGeminiBatchCase[];
  responses: GeminiBatchInlineResponse[];
}) {
  const casesById = new Map(input.cases.map((caseItem) => [caseItem.id, caseItem] as const));
  const seenCaseIds = new Set<string>();
  const results: ParsedGeminiBatchCaseResult[] = [];

  input.responses.forEach((response, index) => {
    const caseId = response.metadata?.caseId ?? input.cases[index]?.id;
    if (!caseId) {
      throw new Error(`Batch response ${index} is missing case metadata.`);
    }

    const caseItem = casesById.get(caseId);
    if (!caseItem) {
      throw new Error(`Batch response referenced unknown case '${caseId}'.`);
    }

    seenCaseIds.add(caseId);

    if (response.error) {
      results.push({
        caseId,
        title: caseItem.title,
        status: 'request-error',
        message: response.error.message ?? 'Gemini Batch returned a request-local error.'
      });
      return;
    }

    const rawText = response.response?.text?.trim();
    if (!rawText) {
      results.push({
        caseId,
        title: caseItem.title,
        status: 'parse-error',
        message: 'Gemini Batch returned an empty response.',
        rawText: rawText ?? undefined
      });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      results.push({
        caseId,
        title: caseItem.title,
        status: 'parse-error',
        message: 'Gemini Batch returned malformed JSON.',
        rawText
      });
      return;
    }

    const schemaResult = reviewExtractionModelOutputSchema.safeParse(parsed);
    if (!schemaResult.success) {
      results.push({
        caseId,
        title: caseItem.title,
        status: 'schema-error',
        message: 'Gemini Batch response did not match the extraction schema.',
        rawText
      });
      return;
    }

    const output = normalizeReviewExtractionModelOutput(schemaResult.data);
    results.push({
      caseId,
      title: caseItem.title,
      status: 'success',
      output,
      fieldScores: buildFieldScores(caseItem, output)
    });
  });

  for (const caseItem of input.cases) {
    if (seenCaseIds.has(caseItem.id)) continue;
    results.push({
      caseId: caseItem.id,
      title: caseItem.title,
      status: 'request-error',
      message: 'Gemini Batch did not return a response for this case.'
    });
  }

  return results;
}

export function summarizeGeminiBatchExtractionResults(
  results: ParsedGeminiBatchCaseResult[]
) {
  const fieldMetrics = {
    brandName: emptyFieldMetric(),
    fancifulName: emptyFieldMetric(),
    classType: emptyFieldMetric(),
    alcoholContent: emptyFieldMetric(),
    netContents: emptyFieldMetric(),
    appellation: emptyFieldMetric(),
    vintage: emptyFieldMetric()
  } satisfies Record<keyof LoadedGeminiBatchCase['expectedFields'], BatchFieldMetrics>;

  let successCount = 0;
  let requestErrorCount = 0;
  let parseErrorCount = 0;
  let schemaErrorCount = 0;

  for (const result of results) {
    if (result.status === 'success') {
      successCount += 1;
      for (const [fieldId, score] of Object.entries(result.fieldScores) as Array<
        [keyof LoadedGeminiBatchCase['expectedFields'], BatchFieldScore]
      >) {
        applyFieldScore(fieldMetrics[fieldId], score);
      }
      continue;
    }

    if (result.status === 'request-error') {
      requestErrorCount += 1;
      continue;
    }
    if (result.status === 'parse-error') {
      parseErrorCount += 1;
      continue;
    }
    schemaErrorCount += 1;
  }

  return {
    successCount,
    requestErrorCount,
    parseErrorCount,
    schemaErrorCount,
    fieldMetrics
  };
}

function createIntake(caseItem: LoadedGeminiBatchCase): NormalizedReviewIntake {
  return {
    label: caseItem.label,
    labels: [caseItem.label],
    fields: caseItem.fields,
    hasApplicationData: caseItem.hasApplicationData,
    standalone: caseItem.standalone
  };
}

function buildFieldScores(
  caseItem: LoadedGeminiBatchCase,
  output: ReviewExtractionModelOutput
) {
  return {
    brandName: scoreField(caseItem.expectedFields.brandName, output.fields.brandName),
    fancifulName: scoreField(caseItem.expectedFields.fancifulName, output.fields.fancifulName),
    classType: scoreField(caseItem.expectedFields.classType, output.fields.classType),
    alcoholContent: scoreField(
      caseItem.expectedFields.alcoholContent,
      output.fields.alcoholContent
    ),
    netContents: scoreField(caseItem.expectedFields.netContents, output.fields.netContents),
    appellation: scoreField(caseItem.expectedFields.appellation, output.fields.appellation),
    vintage: scoreField(caseItem.expectedFields.vintage, output.fields.vintage)
  } satisfies Record<keyof LoadedGeminiBatchCase['expectedFields'], BatchFieldScore>;
}

function scoreField(
  expected: string,
  extracted: {
    present: boolean;
    value?: string;
    confidence: number;
    note?: string;
  }
): BatchFieldScore {
  return {
    expected,
    present: extracted.present,
    extracted: extracted.value ?? null,
    comparison: compareExpectedToExtracted(expected, extracted.value),
    confidence: extracted.confidence,
    note: extracted.note ?? null
  };
}

function compareExpectedToExtracted(
  expected: string,
  extracted: string | undefined
): BatchFieldComparison {
  if (expected.trim().length === 0) {
    return extracted && extracted.trim().length > 0 ? 'mismatch' : 'not-applicable';
  }

  if (!extracted || extracted.trim().length === 0) {
    return 'missing';
  }

  const normalizedExpected = normalizeExact(expected);
  const normalizedExtracted = normalizeExact(extracted);
  if (normalizedExpected === normalizedExtracted) {
    return 'exact';
  }
  if (
    normalizedExpected.toLowerCase() === normalizedExtracted.toLowerCase() ||
    normalizeCosmetic(expected) === normalizeCosmetic(extracted)
  ) {
    return 'cosmetic';
  }

  return 'mismatch';
}

function normalizeExact(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeCosmetic(value: string) {
  return normalizeExact(value)
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function emptyFieldMetric(): BatchFieldMetrics {
  return { total: 0, present: 0, exact: 0, cosmetic: 0, mismatch: 0, missing: 0 };
}

function applyFieldScore(metric: BatchFieldMetrics, score: BatchFieldScore) {
  if (score.comparison === 'not-applicable') {
    return;
  }
  metric.total += 1;
  if (score.present) metric.present += 1;
  if (score.comparison === 'exact') metric.exact += 1;
  if (score.comparison === 'cosmetic') metric.cosmetic += 1;
  if (score.comparison === 'mismatch') metric.mismatch += 1;
  if (score.comparison === 'missing') metric.missing += 1;
}
