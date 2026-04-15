import { z } from 'zod';

export const checkStatusSchema = z.enum(['pass', 'review', 'fail', 'info']);
export const severitySchema = z.enum(['blocker', 'major', 'minor', 'note']);
export const beverageTypeSchema = z.enum([
  'distilled-spirits',
  'wine',
  'malt-beverage',
  'unknown'
]);
export const verdictSchema = z.enum(['approve', 'review', 'reject']);
export const reviewIntakeBeverageSchema = z.enum([
  'auto',
  'distilled-spirits',
  'wine',
  'malt-beverage'
]);
export const originChoiceSchema = z.enum(['domestic', 'imported']);
export const processingStepIdSchema = z.enum([
  'reading-image',
  'extracting-fields',
  'detecting-beverage',
  'running-checks',
  'preparing-evidence'
]);
export const reviewErrorKindSchema = z.enum([
  'validation',
  'timeout',
  'network',
  'adapter',
  'unknown'
]);
export const verificationModeSchema = z.enum(['single-label', 'batch']);
export const extractionQualityStateSchema = z.enum([
  'ok',
  'low-confidence',
  'no-text-extracted'
]);
export const comparisonStatusSchema = z.enum([
  'match',
  'case-mismatch',
  'value-mismatch',
  'not-applicable'
]);
export const beverageTypeSourceSchema = z.enum([
  'application',
  'class-type',
  'model-hint',
  'strict-fallback'
]);
export const visualSignalStatusSchema = z.enum(['yes', 'no', 'uncertain']);
export const WARNING_SUB_CHECK_IDS = [
  'present',
  'exact-text',
  'uppercase-bold-heading',
  'continuous-paragraph',
  'legibility'
] as const;
export const REVIEW_LATENCY_BUDGET_MS = 4000;
export const warningSubCheckIdSchema = z.enum(WARNING_SUB_CHECK_IDS);
export const diffSegmentKindSchema = z.enum([
  'match',
  'missing',
  'wrong-character',
  'wrong-case'
]);

// Backward-compatible aliases while downstream stories migrate to the richer names.
export const verificationStatusSchema = checkStatusSchema;
export const recommendationSchema = verdictSchema;

export const reviewVarietalSchema = z.object({
  name: z.string(),
  percentage: z.string()
});

export const reviewIntakeFieldsSchema = z.object({
  beverageType: reviewIntakeBeverageSchema,
  brandName: z.string(),
  fancifulName: z.string(),
  classType: z.string(),
  alcoholContent: z.string(),
  netContents: z.string(),
  applicantAddress: z.string(),
  origin: originChoiceSchema,
  country: z.string(),
  formulaId: z.string(),
  appellation: z.string(),
  vintage: z.string(),
  varietals: z.array(reviewVarietalSchema)
});

export const reviewErrorSchema = z.object({
  kind: reviewErrorKindSchema,
  message: z.string(),
  retryable: z.boolean()
});

export const comparisonEvidenceSchema = z.object({
  status: comparisonStatusSchema,
  applicationValue: z.string().optional(),
  extractedValue: z.string().optional(),
  note: z.string().optional()
});

export const reviewExtractionFieldSchema = z
  .object({
    present: z.boolean(),
    value: z.string().optional(),
    confidence: z.number().min(0).max(1),
    note: z.string().optional()
  })
  .superRefine((field, context) => {
    const hasValue = field.value !== undefined && field.value.trim().length > 0;

    if (field.present && !hasValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Present extracted fields must include a non-empty value.'
      });
    }

    if (!field.present && field.value !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Absent extracted fields must not include a value.'
      });
    }
  });

export const reviewExtractionVarietalSchema = z.object({
  name: z.string(),
  percentage: z.string().optional(),
  confidence: z.number().min(0).max(1),
  note: z.string().optional()
});

export const reviewExtractionFieldsSchema = z.object({
  brandName: reviewExtractionFieldSchema,
  fancifulName: reviewExtractionFieldSchema,
  classType: reviewExtractionFieldSchema,
  alcoholContent: reviewExtractionFieldSchema,
  netContents: reviewExtractionFieldSchema,
  applicantAddress: reviewExtractionFieldSchema,
  countryOfOrigin: reviewExtractionFieldSchema,
  ageStatement: reviewExtractionFieldSchema,
  sulfiteDeclaration: reviewExtractionFieldSchema,
  appellation: reviewExtractionFieldSchema,
  vintage: reviewExtractionFieldSchema,
  governmentWarning: reviewExtractionFieldSchema,
  varietals: z.array(reviewExtractionVarietalSchema)
});

export const reviewVisualSignalSchema = z.object({
  status: visualSignalStatusSchema,
  confidence: z.number().min(0).max(1),
  note: z.string().optional()
});

export const warningVisualSignalsSchema = z.object({
  prefixAllCaps: reviewVisualSignalSchema,
  prefixBold: reviewVisualSignalSchema,
  continuousParagraph: reviewVisualSignalSchema,
  separateFromOtherContent: reviewVisualSignalSchema
});

export const reviewExtractionImageQualitySchema = z.object({
  score: z.number().min(0).max(1),
  state: extractionQualityStateSchema,
  issues: z.array(z.string()).default([]),
  note: z.string().optional()
});

export const warningSubCheckSchema = z.object({
  id: warningSubCheckIdSchema,
  label: z.string(),
  status: checkStatusSchema,
  reason: z.string()
});

export const warningSubChecksSchema = z
  .array(warningSubCheckSchema)
  .length(WARNING_SUB_CHECK_IDS.length)
  .superRefine((subChecks, context) => {
    for (const [index, id] of WARNING_SUB_CHECK_IDS.entries()) {
      if (subChecks[index]?.id !== id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: `Warning sub-check ${index + 1} must be ${id}.`
        });
      }
    }
  });

export const diffSegmentSchema = z.object({
  kind: diffSegmentKindSchema,
  required: z.string(),
  extracted: z.string()
});

export const warningEvidenceSchema = z.object({
  subChecks: warningSubChecksSchema,
  required: z.string(),
  extracted: z.string(),
  segments: z.array(diffSegmentSchema)
});

export const checkReviewSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: checkStatusSchema,
  severity: severitySchema,
  summary: z.string(),
  details: z.string(),
  confidence: z.number().min(0).max(1),
  citations: z.array(z.string()).default([]),
  applicationValue: z.string().optional(),
  extractedValue: z.string().optional(),
  comparison: comparisonEvidenceSchema.optional(),
  warning: warningEvidenceSchema.optional()
});

export const fieldReviewSchema = checkReviewSchema;

export const extractionQualitySchema = z.object({
  globalConfidence: z.number().min(0).max(1),
  state: extractionQualityStateSchema,
  note: z.string().optional()
});

export const verificationCountsSchema = z.object({
  pass: z.number().int().nonnegative(),
  review: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative()
});

export const verificationReportSchema = z.object({
  id: z.string(),
  mode: verificationModeSchema,
  beverageType: beverageTypeSchema,
  verdict: verdictSchema,
  verdictSecondary: z.string().optional(),
  standalone: z.boolean(),
  extractionQuality: extractionQualitySchema,
  counts: verificationCountsSchema,
  checks: z.array(checkReviewSchema),
  crossFieldChecks: z.array(checkReviewSchema),
  latencyBudgetMs: z.number().int().positive().max(REVIEW_LATENCY_BUDGET_MS),
  noPersistence: z.literal(true),
  summary: z.string()
});

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('ttb-label-verification'),
  mode: z.literal('scaffold'),
  responsesApi: z.literal(true),
  store: z.literal(false),
  timestamp: z.string().datetime()
});

export const reviewExtractionSchema = z
  .object({
    id: z.string(),
    model: z.string(),
    beverageType: beverageTypeSchema,
    beverageTypeSource: beverageTypeSourceSchema,
    modelBeverageTypeHint: beverageTypeSchema.optional(),
    standalone: z.boolean(),
    hasApplicationData: z.boolean(),
    noPersistence: z.literal(true),
    imageQuality: reviewExtractionImageQualitySchema,
    warningSignals: warningVisualSignalsSchema,
    fields: reviewExtractionFieldsSchema,
    summary: z.string()
  })
  .superRefine((payload, context) => {
    if (payload.standalone === payload.hasApplicationData) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['standalone'],
        message:
          'standalone must be the inverse of hasApplicationData in extraction payloads.'
      });
    }
  });

export type CheckStatus = z.infer<typeof checkStatusSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type BeverageType = z.infer<typeof beverageTypeSchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type ReviewIntakeBeverage = z.infer<typeof reviewIntakeBeverageSchema>;
export type OriginChoice = z.infer<typeof originChoiceSchema>;
export type ProcessingStepId = z.infer<typeof processingStepIdSchema>;
export type ReviewErrorKind = z.infer<typeof reviewErrorKindSchema>;
export type VerificationMode = z.infer<typeof verificationModeSchema>;
export type ExtractionQualityState = z.infer<typeof extractionQualityStateSchema>;
export type ComparisonStatus = z.infer<typeof comparisonStatusSchema>;
export type BeverageTypeSource = z.infer<typeof beverageTypeSourceSchema>;
export type VisualSignalStatus = z.infer<typeof visualSignalStatusSchema>;
export type WarningSubCheckId = z.infer<typeof warningSubCheckIdSchema>;
export type DiffSegmentKind = z.infer<typeof diffSegmentKindSchema>;
export type ReviewVarietal = z.infer<typeof reviewVarietalSchema>;
export type ReviewIntakeFields = z.infer<typeof reviewIntakeFieldsSchema>;
export type ReviewError = z.infer<typeof reviewErrorSchema>;
export type ComparisonEvidence = z.infer<typeof comparisonEvidenceSchema>;
export type ReviewExtractionField = z.infer<typeof reviewExtractionFieldSchema>;
export type ReviewExtractionVarietal = z.infer<typeof reviewExtractionVarietalSchema>;
export type ReviewExtractionFields = z.infer<typeof reviewExtractionFieldsSchema>;
export type ReviewVisualSignal = z.infer<typeof reviewVisualSignalSchema>;
export type WarningVisualSignals = z.infer<typeof warningVisualSignalsSchema>;
export type ReviewExtractionImageQuality = z.infer<typeof reviewExtractionImageQualitySchema>;
export type WarningSubCheck = z.infer<typeof warningSubCheckSchema>;
export type DiffSegment = z.infer<typeof diffSegmentSchema>;
export type WarningEvidence = z.infer<typeof warningEvidenceSchema>;
export type CheckReview = z.infer<typeof checkReviewSchema>;
export type ExtractionQuality = z.infer<typeof extractionQualitySchema>;
export type VerificationCounts = z.infer<typeof verificationCountsSchema>;
export type VerificationReport = z.infer<typeof verificationReportSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReviewExtraction = z.infer<typeof reviewExtractionSchema>;
export type VerificationStatus = CheckStatus;
export type Recommendation = Verdict;
export type FieldReview = CheckReview;

export const CANONICAL_GOVERNMENT_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';
