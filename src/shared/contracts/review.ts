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

export const SUPPORTED_LABEL_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
] as const;
export const MAX_LABEL_UPLOAD_BYTES = 10 * 1024 * 1024;
export const BATCH_LABEL_CAP = 50;
export const BATCH_CSV_EXPECTED_HEADERS = [
  'filename',
  'beverage_type',
  'brand_name',
  'fanciful_name',
  'class_type',
  'alcohol_content',
  'net_contents',
  'applicant_address',
  'origin',
  'country',
  'formula_id',
  'appellation',
  'vintage'
] as const;
export const BATCH_CSV_REQUIRED_HEADERS = [
  'filename',
  'brand_name',
  'class_type',
  'alcohol_content',
  'net_contents'
] as const;

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
  latencyBudgetMs: z.number().int().positive().max(5000),
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

export const batchRunPhaseSchema = z.enum(['complete', 'cancelled-partial']);
export const batchFileErrorReasonSchema = z.enum([
  'unsupported-type',
  'oversized',
  'duplicate',
  'over-cap'
]);

export const batchLabelFileSchema = z.object({
  clientId: z.string(),
  filename: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string()
});

export const batchPreflightRequestSchema = z.object({
  batchClientId: z.string(),
  images: z.array(batchLabelFileSchema).max(BATCH_LABEL_CAP + 25),
  csv: z.object({
    filename: z.string(),
    sizeBytes: z.number().int().nonnegative()
  })
});

export const batchCsvRowSchema = z.object({
  id: z.string(),
  rowIndex: z.number().int().positive(),
  filenameHint: z.string(),
  brandName: z.string(),
  classType: z.string()
});

export const batchMatchedPairSchema = z.object({
  imageId: z.string(),
  row: batchCsvRowSchema,
  source: z.enum(['filename', 'order'])
});

export const batchAmbiguousSchema = z.object({
  imageId: z.string(),
  candidates: z.array(batchCsvRowSchema).min(2)
});

export const batchFileErrorSchema = z.object({
  filename: z.string(),
  reason: batchFileErrorReasonSchema,
  message: z.string()
});

export const batchPreflightResponseSchema = z.object({
  batchSessionId: z.string(),
  csvHeaders: z.array(z.string()),
  csvRows: z.array(batchCsvRowSchema),
  matching: z.object({
    matched: z.array(batchMatchedPairSchema),
    ambiguous: z.array(batchAmbiguousSchema),
    unmatchedImageIds: z.array(z.string()),
    unmatchedRowIds: z.array(z.string())
  }),
  csvError: z
    .object({
      message: z.string()
    })
    .optional(),
  fileErrors: z.array(batchFileErrorSchema).default([])
});

export const batchResolutionSchema = z.object({
  imageId: z.string(),
  action: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('matched'),
      rowId: z.string()
    }),
    z.object({
      kind: z.literal('dropped')
    })
  ])
});

export const batchStartRequestSchema = z.object({
  batchSessionId: z.string(),
  resolutions: z.array(batchResolutionSchema)
});

export const batchItemStatusSchema = z.enum(['pass', 'review', 'fail', 'error']);

export const batchStreamProgressSchema = z.object({
  type: z.literal('progress'),
  done: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  secondsRemainingEstimate: z.number().int().nonnegative().optional()
});

export const batchStreamItemSchema = z.object({
  type: z.literal('item'),
  itemId: z.string(),
  imageId: z.string(),
  filename: z.string(),
  identity: z.string(),
  status: batchItemStatusSchema,
  reportId: z.string().optional(),
  errorMessage: z.string().optional()
});

export const batchStreamSummarySchema = z.object({
  type: z.literal('summary'),
  total: z.number().int().nonnegative(),
  pass: z.number().int().nonnegative(),
  review: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  error: z.number().int().nonnegative(),
  dashboardHandle: z.object({
    sessionId: z.string()
  })
});

export const batchStreamFrameSchema = z.discriminatedUnion('type', [
  batchStreamProgressSchema,
  batchStreamItemSchema,
  batchStreamSummarySchema
]);

export const batchDashboardIssuesSchema = z.object({
  blocker: z.number().int().nonnegative(),
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  note: z.number().int().nonnegative()
});

export const batchDashboardRowSchema = z.object({
  rowId: z.string(),
  reportId: z.string().nullable(),
  imageId: z.string(),
  filename: z.string(),
  brandName: z.string(),
  classType: z.string(),
  beverageType: beverageTypeSchema,
  status: batchItemStatusSchema,
  previewUrl: z.string().nullable(),
  isPdf: z.boolean(),
  sizeLabel: z.string(),
  issues: batchDashboardIssuesSchema,
  confidenceState: extractionQualityStateSchema,
  errorMessage: z.string().nullable(),
  completedOrder: z.number().int().positive()
});

export const batchDashboardSummarySchema = z.object({
  pass: z.number().int().nonnegative(),
  review: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  error: z.number().int().nonnegative()
});

export const batchDashboardResponseSchema = z.object({
  batchSessionId: z.string(),
  phase: batchRunPhaseSchema,
  totals: z.object({
    started: z.number().int().nonnegative(),
    done: z.number().int().nonnegative()
  }),
  summary: batchDashboardSummarySchema,
  rows: z.array(batchDashboardRowSchema)
});

export const batchExportPayloadSchema = z.object({
  generatedAt: z.string().datetime(),
  phase: batchRunPhaseSchema,
  totals: z.object({
    started: z.number().int().nonnegative(),
    done: z.number().int().nonnegative()
  }),
  summary: batchDashboardSummarySchema,
  rows: z.array(batchDashboardRowSchema),
  reports: z.record(z.string(), verificationReportSchema),
  noPersistence: z.literal(true)
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
export type BatchRunPhase = z.infer<typeof batchRunPhaseSchema>;
export type BatchFileErrorReason = z.infer<typeof batchFileErrorReasonSchema>;
export type ReviewVarietal = z.infer<typeof reviewVarietalSchema>;
export type ReviewIntakeFields = z.infer<typeof reviewIntakeFieldsSchema>;
export type ReviewError = z.infer<typeof reviewErrorSchema>;
export type ComparisonEvidence = z.infer<typeof comparisonEvidenceSchema>;
export type ReviewExtractionField = z.infer<typeof reviewExtractionFieldSchema>;
export type ReviewExtractionVarietal = z.infer<typeof reviewExtractionVarietalSchema>;
export type ReviewExtractionFields = z.infer<typeof reviewExtractionFieldsSchema>;
export type ReviewVisualSignal = z.infer<typeof reviewVisualSignalSchema>;
export type WarningVisualSignals = z.infer<typeof warningVisualSignalsSchema>;
export type ReviewExtractionImageQuality = z.infer<
  typeof reviewExtractionImageQualitySchema
>;
export type WarningSubCheck = z.infer<typeof warningSubCheckSchema>;
export type DiffSegment = z.infer<typeof diffSegmentSchema>;
export type WarningEvidence = z.infer<typeof warningEvidenceSchema>;
export type CheckReview = z.infer<typeof checkReviewSchema>;
export type ExtractionQuality = z.infer<typeof extractionQualitySchema>;
export type VerificationCounts = z.infer<typeof verificationCountsSchema>;
export type VerificationReport = z.infer<typeof verificationReportSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReviewExtraction = z.infer<typeof reviewExtractionSchema>;
export type BatchLabelFile = z.infer<typeof batchLabelFileSchema>;
export type BatchPreflightRequest = z.infer<typeof batchPreflightRequestSchema>;
export type BatchCsvRow = z.infer<typeof batchCsvRowSchema>;
export type BatchMatchedPair = z.infer<typeof batchMatchedPairSchema>;
export type BatchAmbiguous = z.infer<typeof batchAmbiguousSchema>;
export type BatchFileError = z.infer<typeof batchFileErrorSchema>;
export type BatchPreflightResponse = z.infer<typeof batchPreflightResponseSchema>;
export type BatchResolution = z.infer<typeof batchResolutionSchema>;
export type BatchStartRequest = z.infer<typeof batchStartRequestSchema>;
export type BatchItemStatus = z.infer<typeof batchItemStatusSchema>;
export type BatchStreamProgress = z.infer<typeof batchStreamProgressSchema>;
export type BatchStreamItem = z.infer<typeof batchStreamItemSchema>;
export type BatchStreamSummary = z.infer<typeof batchStreamSummarySchema>;
export type BatchStreamFrame = z.infer<typeof batchStreamFrameSchema>;
export type BatchDashboardIssues = z.infer<typeof batchDashboardIssuesSchema>;
export type BatchDashboardRow = z.infer<typeof batchDashboardRowSchema>;
export type BatchDashboardSummary = z.infer<typeof batchDashboardSummarySchema>;
export type BatchDashboardResponse = z.infer<typeof batchDashboardResponseSchema>;
export type BatchExportPayload = z.infer<typeof batchExportPayloadSchema>;
export type VerificationStatus = CheckStatus;
export type Recommendation = Verdict;
export type FieldReview = CheckReview;

export const CANONICAL_GOVERNMENT_WARNING =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

const SEED_WARNING_EXTRACTED =
  'Government Warning: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

export const seedVerificationReport: VerificationReport = {
  id: 'seed-distilled-spirits-002',
  mode: 'single-label',
  beverageType: 'distilled-spirits',
  verdict: 'review',
  verdictSecondary: 'Low extraction confidence — review carefully.',
  standalone: false,
  extractionQuality: {
    globalConfidence: 0.68,
    state: 'low-confidence',
    note:
      'Seed fixture keeps ambiguous visual judgments in review until live extraction and validator stories land.'
  },
  counts: {
    pass: 1,
    review: 3,
    fail: 0
  },
  latencyBudgetMs: 5000,
  noPersistence: true,
  summary:
    'Scaffold result only. The shared contract now mirrors the approved TTB-102 results UI while live extraction and validators land in later stories.',
  checks: [
    {
      id: 'brand-name',
      label: 'Brand name',
      status: 'pass',
      severity: 'note',
      summary: 'Application value and extracted label text match.',
      details:
        'Seed fixture includes one exact comparison match so the approved evidence panel can render the pass state from the shared contract.',
      confidence: 0.99,
      citations: ['TTB distilled spirits mandatory label information'],
      applicationValue: "Stone's Throw",
      extractedValue: "Stone's Throw",
      comparison: {
        status: 'match',
        applicationValue: "Stone's Throw",
        extractedValue: "Stone's Throw",
        note: 'Normalized strings match exactly.'
      }
    },
    {
      id: 'alcohol-content',
      label: 'Alcohol content',
      status: 'review',
      severity: 'minor',
      summary: 'Formatting difference requires a quick human check.',
      details:
        'The extracted value differs only by letter casing. The richer contract preserves that cosmetic mismatch as review rather than a hard fail.',
      confidence: 0.86,
      citations: [
        'TTB distilled spirits mandatory label information',
        'TTB product spec cosmetic comparison guidance'
      ],
      applicationValue: '45% Alc./Vol.',
      extractedValue: '45% alc./vol.',
      comparison: {
        status: 'case-mismatch',
        applicationValue: '45% Alc./Vol.',
        extractedValue: '45% alc./vol.',
        note: 'Only letter casing differs after normalization.'
      }
    },
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'review',
      severity: 'blocker',
      summary:
        'Government warning remains a blocker-class review until deterministic validation is wired.',
      details:
        'Seed fixture now carries sub-checks and a character diff so the approved TTB-102 warning evidence surface can bind to the shared contract before live validation lands.',
      confidence: 0.62,
      citations: [
        'TTB distilled spirits health warning guidance',
        '27 CFR part 16'
      ],
      extractedValue: SEED_WARNING_EXTRACTED,
      warning: {
        subChecks: [
          {
            id: 'present',
            label: 'Warning text is present',
            status: 'pass',
            reason: 'Warning text was detected in the submitted label.'
          },
          {
            id: 'exact-text',
            label: 'Warning text matches required wording',
            status: 'review',
            reason:
              'Seed fixture keeps exact-wording judgment in review until the deterministic warning validator lands.'
          },
          {
            id: 'uppercase-bold-heading',
            label: 'Warning heading is uppercase and bold',
            status: 'review',
            reason:
              'Typography-specific judgments stay reversible until image-quality assessment and warning validation are live.'
          },
          {
            id: 'continuous-paragraph',
            label: 'Warning is a continuous paragraph',
            status: 'pass',
            reason: 'The extracted warning appears as a continuous paragraph in the scaffold evidence.'
          },
          {
            id: 'legibility',
            label: 'Warning is legible at label size',
            status: 'review',
            reason:
              'Legibility remains a review call until the extraction adapter can score image quality directly.'
          }
        ],
        required: CANONICAL_GOVERNMENT_WARNING,
        extracted: SEED_WARNING_EXTRACTED,
        segments: [
          {
            kind: 'wrong-case',
            required: 'GOVERNMENT WARNING',
            extracted: 'Government Warning'
          },
          {
            kind: 'match',
            required:
              ': (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
            extracted:
              ': (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.'
          }
        ]
      }
    }
  ],
  crossFieldChecks: [
    {
      id: 'same-field-of-vision',
      label: 'Same field of vision',
      status: 'review',
      severity: 'major',
      summary:
        'Spatial verification remains a review state until the extraction layer can localize brand name, class/type, and alcohol content reliably.',
      details:
        'Per TTB guidance, brand name, class/type, and alcohol content must appear in the same field of vision. The scaffold keeps this reversible while later stories add real spatial evidence.',
      confidence: 0.54,
      citations: [
        'TTB distilled spirits mandatory label information',
        '27 CFR 5.61 and related TTB guidance'
      ]
    }
  ]
};

const standaloneSeedVerificationReport: VerificationReport = {
  id: 'seed-standalone-001',
  mode: 'single-label',
  beverageType: 'distilled-spirits',
  verdict: 'review',
  standalone: true,
  extractionQuality: {
    globalConfidence: 0.68,
    state: 'low-confidence',
    note:
      'Seed fixture keeps low-confidence extraction reversible while standalone review flows through the approved results UI.'
  },
  counts: {
    pass: 1,
    review: 2,
    fail: 0
  },
  latencyBudgetMs: 5000,
  noPersistence: true,
  summary:
    'Standalone scaffold result only. Extracted values are available without application-data comparisons.',
  checks: [
    {
      id: 'brand-name',
      label: 'Brand name',
      status: 'pass',
      severity: 'note',
      summary: 'Extracted brand text is available for standalone review.',
      details:
        'No application value was provided, so the standalone flow shows extracted label text without a comparison verdict.',
      confidence: 0.97,
      citations: ['TTB distilled spirits mandatory label information'],
      extractedValue: "Stone's Throw",
      comparison: {
        status: 'not-applicable',
        note: 'No application value was supplied for standalone review.'
      }
    },
    {
      id: 'alcohol-content',
      label: 'Alcohol content',
      status: 'review',
      severity: 'minor',
      summary: 'Alcohol content is visible, but image quality keeps this in review.',
      details:
        'Standalone mode keeps low-confidence extraction judgments reversible while no application comparison is available.',
      confidence: 0.74,
      citations: [
        'TTB distilled spirits mandatory label information',
        'TTB product spec cosmetic comparison guidance'
      ],
      extractedValue: '45% alc./vol.',
      comparison: {
        status: 'not-applicable',
        note: 'No application value was supplied for standalone review.'
      }
    },
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'review',
      severity: 'blocker',
      summary:
        'Government warning remains a blocker-class review until deterministic validation is wired.',
      details:
        'Standalone review still carries warning evidence, but exact-text and typography judgments remain reversible until the validator and image-quality pipeline are fully live.',
      confidence: 0.62,
      citations: [
        'TTB distilled spirits health warning guidance',
        '27 CFR part 16'
      ],
      extractedValue: SEED_WARNING_EXTRACTED,
      warning: seedVerificationReport.checks.find(
        (check) => check.id === 'government-warning'
      )?.warning
    }
  ],
  crossFieldChecks: [
    {
      id: 'same-field-of-vision',
      label: 'Same field of vision',
      status: 'info',
      severity: 'note',
      summary: 'Cross-field dependency skipped in standalone mode.',
      details:
        'Application-backed cross-field checks are skipped when no application form was provided.',
      confidence: 1,
      citations: [
        'TTB distilled spirits mandatory label information',
        '27 CFR 5.61 and related TTB guidance'
      ]
    }
  ]
};

export function getSeedVerificationReport(options: {
  standalone?: boolean;
  applicationFields?: Partial<ReviewIntakeFields>;
} = {}): VerificationReport {
  const baseReport = options.standalone
    ? standaloneSeedVerificationReport
    : seedVerificationReport;
  const report =
    options.standalone || !options.applicationFields
      ? baseReport
      : overlaySeedApplicationFields(baseReport, options.applicationFields);

  return verificationReportSchema.parse(
    report
  );
}

type SeedApplicationField = 'brandName' | 'alcoholContent';

const SEED_APPLICATION_FIELD_MAP = [
  {
    checkId: 'brand-name',
    field: 'brandName'
  },
  {
    checkId: 'alcohol-content',
    field: 'alcoholContent'
  }
] as const satisfies ReadonlyArray<{
  checkId: string;
  field: SeedApplicationField;
}>;

function overlaySeedApplicationFields(
  report: VerificationReport,
  applicationFields: Partial<Pick<ReviewIntakeFields, SeedApplicationField>>
): VerificationReport {
  const checks = report.checks.map((check) => {
    const mapping = SEED_APPLICATION_FIELD_MAP.find((entry) => entry.checkId === check.id);
    if (!mapping) {
      return check;
    }

    const applicationValue = normalizeSeedApplicationValue(applicationFields[mapping.field]);
    if (!applicationValue) {
      return check;
    }

    return overlaySeedComparisonCheck(check, applicationValue);
  });

  return {
    ...report,
    checks,
    counts: countVerificationStatuses(checks, report.crossFieldChecks)
  };
}

function overlaySeedComparisonCheck(
  check: CheckReview,
  applicationValue: string
): CheckReview {
  const extractedValue = check.extractedValue;
  const comparisonStatus = compareSeedValues(applicationValue, extractedValue);

  return {
    ...check,
    status: comparisonStatus === 'match' ? 'pass' : 'review',
    summary: seedComparisonSummary(comparisonStatus),
    details: seedComparisonDetails(comparisonStatus),
    applicationValue,
    comparison: {
      status: comparisonStatus,
      applicationValue,
      extractedValue,
      note: seedComparisonNote(comparisonStatus)
    }
  };
}

function compareSeedValues(
  applicationValue: string,
  extractedValue: string | undefined
): ComparisonStatus {
  if (!extractedValue || extractedValue.length === 0) {
    return 'value-mismatch';
  }

  if (applicationValue === extractedValue) {
    return 'match';
  }

  if (applicationValue.toLowerCase() === extractedValue.toLowerCase()) {
    return 'case-mismatch';
  }

  return 'value-mismatch';
}

function seedComparisonSummary(status: ComparisonStatus): string {
  switch (status) {
    case 'match':
      return 'Application value and extracted label text match.';
    case 'case-mismatch':
      return 'Formatting difference requires a quick human check.';
    case 'value-mismatch':
      return 'Application data and extracted label text differ.';
    case 'not-applicable':
      return 'No application comparison is available.';
  }
}

function seedComparisonDetails(status: ComparisonStatus): string {
  switch (status) {
    case 'match':
      return 'Submitted application value matches the extracted label text after normalization.';
    case 'case-mismatch':
      return 'Submitted application value differs from extracted label text only by letter casing.';
    case 'value-mismatch':
      return 'Submitted application value does not match the extracted label text, so this remains a review state until the live deterministic comparison path lands.';
    case 'not-applicable':
      return 'No application data was supplied for this review.';
  }
}

function seedComparisonNote(status: ComparisonStatus): string {
  switch (status) {
    case 'match':
      return 'Normalized strings match exactly.';
    case 'case-mismatch':
      return 'Only letter casing differs after normalization.';
    case 'value-mismatch':
      return 'Submitted application value does not match extracted label text.';
    case 'not-applicable':
      return 'No application value was supplied for standalone review.';
  }
}

function normalizeSeedApplicationValue(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function countVerificationStatuses(
  checks: CheckReview[],
  crossFieldChecks: CheckReview[]
): VerificationCounts {
  const counts: VerificationCounts = {
    pass: 0,
    review: 0,
    fail: 0
  };

  for (const check of [...checks, ...crossFieldChecks]) {
    if (check.status === 'pass') counts.pass += 1;
    if (check.status === 'review') counts.review += 1;
    if (check.status === 'fail') counts.fail += 1;
  }

  return counts;
}
