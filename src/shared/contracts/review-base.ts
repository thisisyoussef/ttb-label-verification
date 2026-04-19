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
export const reviewRelevanceDecisionSchema = z.enum([
  'likely-label',
  'uncertain',
  'unlikely-label'
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
export const warningResultOverallSchema = z.enum(['pass', 'review', 'reject']);
export const warningResultFocusSchema = z.enum([
  'verified',
  'verified-minor-noise',
  'verified-extra-text',
  'text-unclear',
  'formatting-check',
  'not-found',
  'partial-match',
  'missing-language',
  'incorrect-text'
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

export const reviewRelevanceSignalsSchema = z.object({
  scannedImageCount: z.number().int().positive(),
  textLength: z.number().int().nonnegative(),
  alcoholKeywordHits: z.number().int().nonnegative(),
  hasAlcoholContent: z.boolean(),
  hasNetContents: z.boolean(),
  hasGovernmentWarning: z.boolean(),
  hasClassType: z.boolean(),
  hasApplicantAddress: z.boolean(),
  hasCountryOfOrigin: z.boolean()
});

export const reviewRelevanceResultSchema = z.object({
  decision: reviewRelevanceDecisionSchema,
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  detectedBeverage: beverageTypeSchema.optional(),
  shouldPrefetchExtraction: z.boolean(),
  continueAllowed: z.literal(true),
  noPersistence: z.literal(true),
  signals: reviewRelevanceSignalsSchema
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
    note: z.string().optional(),
    /**
     * Verification-mode output for identifier fields. When the extractor
     * runs in verification mode (VERIFICATION_MODE=on and application
     * data was provided), the model is asked "is this applicant-declared
     * value visible on the label?" — and the answer, the exact label
     * text, goes here. Bottom-up extraction paths leave this undefined
     * and keep writing to `value` as before.
     */
    visibleText: z.string().optional(),
    /**
     * When the model sees a DIFFERENT value in the position where it
     * expected the applicant-declared one (e.g. a prominent fanciful
     * name where the brand was expected), it reports it here so the
     * reviewer can see the mismatch. Always paired with
     * `present: true` and `visibleText` of the primary read.
     */
    alternativeReading: z.string().optional(),
    /**
     * Zero-indexed ordinal of the uploaded label image the value was
     * read from (0 = first file submitted, 1 = second, etc.). Only set
     * when a multi-image intake was submitted AND the extractor could
     * attribute the evidence. `null`/omitted on single-image intakes and
     * on non-VLM merged values where attribution is not tracked.
     *
     * No front/back semantics — ordinal reflects upload order only.
     */
    evidenceImage: z.number().int().min(0).nullable().optional()
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

export const warningSignalScoresSchema = z.object({
  vlm: z.number().min(0).max(1).nullable(),
  ocrCropped: z.number().min(0).max(1).nullable(),
  ocrFull: z.number().min(0).max(1).nullable()
});

export const warningResultSchema = z.object({
  overall: warningResultOverallSchema,
  label: z.string(),
  sublabel: z.string(),
  focus: warningResultFocusSchema,
  confidence: z.number().min(0).max(1),
  signalScores: warningSignalScoresSchema,
  extractedText: z.string(),
  canonicalDiff: z.array(diffSegmentSchema)
});

export const warningEvidenceSchema = z.object({
  subChecks: warningSubChecksSchema,
  required: z.string(),
  extracted: z.string(),
  segments: z.array(diffSegmentSchema),
  result: warningResultSchema.optional()
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
  warning: warningEvidenceSchema.optional(),
  /**
   * Zero-indexed ordinal of the uploaded label image that produced the
   * extracted value, propagated from the underlying
   * `ReviewExtractionField.evidenceImage`. Absent on single-image
   * reviews and on cross-field checks that aren't tied to a single
   * extraction slot. No front/back semantics — strictly upload order.
   */
  evidenceImage: z.number().int().min(0).nullable().optional()
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
export type ReviewRelevanceDecision = z.infer<typeof reviewRelevanceDecisionSchema>;
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
export type ReviewRelevanceSignals = z.infer<typeof reviewRelevanceSignalsSchema>;
export type ReviewRelevanceResult = z.infer<typeof reviewRelevanceResultSchema>;
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
export type WarningResult = z.infer<typeof warningResultSchema>;
export type WarningResultFocus = z.infer<typeof warningResultFocusSchema>;
export type WarningResultOverall = z.infer<typeof warningResultOverallSchema>;
export type WarningSignalScores = z.infer<typeof warningSignalScoresSchema>;
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

/**
 * Sentinel phrase included in `comparison.note` when a field value came
 * from the OCR fallback rather than the VLM's primary read. The server
 * writes it; the client uses substring detection to surface a "Likely"
 * badge on the label-side comparison cell. Kept as a shared constant
 * so there is one canonical phrase — drift between server and client
 * would silently break the badge.
 */
export const OCR_FALLBACK_SENTINEL = 'likely from the label (not verified by the vision model)';
