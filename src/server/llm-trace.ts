import { getCurrentRunTree, traceable } from 'langsmith/traceable';

import type {
  CheckReview,
  ReviewExtraction,
  VerificationReport
} from '../shared/contracts/review';
import { buildGovernmentWarningCheck } from './government-warning-validator';
import {
  REVIEW_EXTRACTION_GUARDRAIL_POLICY,
  REVIEW_EXTRACTION_MODE,
  REVIEW_EXTRACTION_PROMPT_PROFILE,
  REVIEW_EXTRACTION_PROVIDER,
  type LlmEndpointSurface
} from './llm-policy';
import type { NormalizedReviewIntake } from './review-intake';
import { buildVerificationReport } from './review-report';
import type { ReviewExtractor } from './review-extraction';

type TraceMetadataInput = {
  surface: LlmEndpointSurface;
  extractionMode?: string;
  clientTraceId?: string;
  fixtureId?: string;
  provider?: string;
  promptProfile?: string;
  guardrailPolicy?: string;
};

export type TracedReviewExtractionInput = TraceMetadataInput & {
  intake: NormalizedReviewIntake;
  extractor: ReviewExtractor;
};

type TracedWarningValidationInput = TraceMetadataInput & {
  extraction: ReviewExtraction;
};

type TracedReviewReportInput = TraceMetadataInput & {
  intake: NormalizedReviewIntake;
  extraction: ReviewExtraction;
  warningCheck: CheckReview;
  reportId?: string;
};

export type TracedReviewSurfaceInput = TracedReviewExtractionInput & {
  reportId?: string;
};

export type TracedExtractionSurfaceInput = TracedReviewExtractionInput;

export type TracedWarningSurfaceInput = TracedReviewExtractionInput;

type TraceStageTimings = {
  extraction: number;
  warning?: number;
  report?: number;
  total: number;
};

type ReviewSurfaceTraceResult = {
  report: VerificationReport;
  warningCheck: CheckReview;
  stageTimingsMs: TraceStageTimings;
};

type ExtractionSurfaceTraceResult = {
  extraction: ReviewExtraction;
  stageTimingsMs: TraceStageTimings;
};

type WarningSurfaceTraceResult = {
  extraction: ReviewExtraction;
  warningCheck: CheckReview;
  stageTimingsMs: TraceStageTimings;
};

function resolveTraceMetadata(input: TraceMetadataInput) {
  return {
    surface: input.surface,
    extractionMode: input.extractionMode ?? REVIEW_EXTRACTION_MODE,
    provider: input.provider ?? REVIEW_EXTRACTION_PROVIDER,
    promptProfile: input.promptProfile ?? REVIEW_EXTRACTION_PROMPT_PROFILE,
    guardrailPolicy:
      input.guardrailPolicy ?? REVIEW_EXTRACTION_GUARDRAIL_POLICY,
    clientTraceId: input.clientTraceId ?? null,
    fixtureId: input.fixtureId ?? null
  };
}

function annotateCurrentRun(input: TraceMetadataInput) {
  const runTree = getCurrentRunTree(true);
  if (!runTree) {
    return;
  }

  const metadata = resolveTraceMetadata(input);
  runTree.metadata = {
    ...runTree.metadata,
    endpointSurface: metadata.surface,
    extractionMode: metadata.extractionMode,
    provider: metadata.provider,
    promptProfile: metadata.promptProfile,
    guardrailPolicy: metadata.guardrailPolicy,
    clientTraceId: metadata.clientTraceId,
    fixtureId: metadata.fixtureId,
    noPersistence: true
  };
  runTree.tags = [
    ...new Set([
      ...(runTree.tags ?? []),
      'privacy-safe',
      `surface:${metadata.surface}`,
      `mode:${metadata.extractionMode}`,
      `provider:${metadata.provider}`
    ])
  ];
}

function inferProviderFromModel(model: string) {
  const normalizedModel = model.trim().toLowerCase();

  if (normalizedModel.startsWith('gemini')) {
    return 'gemini';
  }

  if (normalizedModel.startsWith('gpt-') || normalizedModel.includes('openai')) {
    return 'openai';
  }

  if (normalizedModel.includes('qwen') || normalizedModel.includes('ollama')) {
    return 'ollama';
  }

  return undefined;
}

function summarizeApplicationFields(intake: NormalizedReviewIntake) {
  const fieldEntries: Array<[string, string | undefined]> = [
    ['brandName', intake.fields.brandName],
    ['fancifulName', intake.fields.fancifulName],
    ['classType', intake.fields.classType],
    ['alcoholContent', intake.fields.alcoholContent],
    ['netContents', intake.fields.netContents],
    ['applicantAddress', intake.fields.applicantAddress],
    ['country', intake.fields.country],
    ['formulaId', intake.fields.formulaId],
    ['appellation', intake.fields.appellation],
    ['vintage', intake.fields.vintage]
  ];

  return {
    hasApplicationData: intake.hasApplicationData,
    standalone: intake.standalone,
    beverageTypeHint: intake.fields.beverageTypeHint,
    origin: intake.fields.origin,
    populatedFieldIds: fieldEntries
      .filter(([, value]) => Boolean(value && value.trim().length > 0))
      .map(([fieldId]) => fieldId)
      .sort(),
    varietalCount: intake.fields.varietals.length
  };
}

function summarizeLabel(intake: NormalizedReviewIntake) {
  return {
    mimeType: intake.label.mimeType,
    bytes: intake.label.bytes,
    isPdf: intake.label.mimeType === 'application/pdf'
  };
}

function summarizeExtraction(extraction: ReviewExtraction) {
  const presentFieldIds = Object.entries(extraction.fields)
    .filter(([fieldId, value]) => {
      if (Array.isArray(value)) {
        return fieldId === 'varietals' && value.length > 0;
      }

      return value.present;
    })
    .map(([fieldId]) => fieldId)
    .sort();

  return {
    id: extraction.id,
    model: extraction.model,
    beverageType: extraction.beverageType,
    beverageTypeSource: extraction.beverageTypeSource,
    modelBeverageTypeHint: extraction.modelBeverageTypeHint ?? 'unknown',
    standalone: extraction.standalone,
    hasApplicationData: extraction.hasApplicationData,
    noPersistence: extraction.noPersistence,
    imageQualityState: extraction.imageQuality.state,
    imageQualityScore: extraction.imageQuality.score,
    imageIssueCount: extraction.imageQuality.issues.length,
    presentFieldIds,
    varietalCount: extraction.fields.varietals.length,
    warningSignalStatuses: {
      prefixAllCaps: extraction.warningSignals.prefixAllCaps.status,
      prefixBold: extraction.warningSignals.prefixBold.status,
      continuousParagraph: extraction.warningSignals.continuousParagraph.status,
      separateFromOtherContent:
        extraction.warningSignals.separateFromOtherContent.status
    }
  };
}

function summarizeWarningCheck(warningCheck: CheckReview) {
  const failingSubCheckIds =
    warningCheck.warning?.subChecks
      .filter((subCheck) => subCheck.status !== 'pass')
      .map((subCheck) => subCheck.id) ?? [];

  return {
    id: warningCheck.id,
    status: warningCheck.status,
    severity: warningCheck.severity,
    confidence: warningCheck.confidence,
    failingSubCheckIds
  };
}

function summarizeVerificationReport(report: VerificationReport) {
  const reviewCheckIds = [...report.checks, ...report.crossFieldChecks]
    .filter((check) => check.status === 'review')
    .map((check) => check.id)
    .sort();
  const failCheckIds = [...report.checks, ...report.crossFieldChecks]
    .filter((check) => check.status === 'fail')
    .map((check) => check.id)
    .sort();

  return {
    id: report.id,
    mode: report.mode,
    verdict: report.verdict,
    verdictSecondary: report.verdictSecondary ?? null,
    beverageType: report.beverageType,
    standalone: report.standalone,
    extractionQualityState: report.extractionQuality.state,
    counts: report.counts,
    warningStatus:
      report.checks.find((check) => check.id === 'government-warning')?.status ??
      null,
    reviewCheckIds,
    failCheckIds,
    noPersistence: report.noPersistence
  };
}

function summarizeStageTimings(stageTimingsMs: TraceStageTimings) {
  return {
    extraction: stageTimingsMs.extraction,
    warning: stageTimingsMs.warning ?? null,
    report: stageTimingsMs.report ?? null,
    total: stageTimingsMs.total
  };
}

async function measureStage<T>(runner: () => Promise<T>) {
  const startedAt = performance.now();
  const result = await runner();

  return {
    result,
    elapsedMs: Math.round(performance.now() - startedAt)
  };
}

const tracedReviewExtraction = traceable(
  async (input: TracedReviewExtractionInput) => {
    annotateCurrentRun(input);
    const extraction = await input.extractor(input.intake);
    const actualProvider = inferProviderFromModel(extraction.model);

    if (actualProvider) {
      annotateCurrentRun({
        ...input,
        provider: actualProvider
      });
    }

    return extraction;
  },
  {
    name: 'ttb.review_extraction.stage',
    run_type: 'chain',
    processInputs: (input: TracedReviewExtractionInput) => ({
      ...resolveTraceMetadata(input),
      label: summarizeLabel(input.intake),
      intake: summarizeApplicationFields(input.intake),
      noPersistence: true
    }),
    processOutputs: (output: ReviewExtraction) => summarizeExtraction(output),
    tags: ['ttb', 'llm', 'review-extraction', 'privacy-safe']
  }
);

const tracedWarningValidation = traceable(
  async (input: TracedWarningValidationInput) => {
    annotateCurrentRun(input);
    return buildGovernmentWarningCheck(input.extraction);
  },
  {
    name: 'ttb.warning_validation.stage',
    run_type: 'chain',
    processInputs: (input: TracedWarningValidationInput) => ({
      ...resolveTraceMetadata(input),
      extraction: summarizeExtraction(input.extraction),
      noPersistence: true
    }),
    processOutputs: (output: CheckReview) => summarizeWarningCheck(output),
    tags: ['ttb', 'llm', 'warning-validation', 'privacy-safe']
  }
);

const tracedReviewReport = traceable(
  async (input: TracedReviewReportInput) => {
    annotateCurrentRun(input);
    return buildVerificationReport({
      intake: input.intake,
      extraction: input.extraction,
      warningCheck: input.warningCheck,
      id: input.reportId
    });
  },
  {
    name: 'ttb.review_report.stage',
    run_type: 'chain',
    processInputs: (input: TracedReviewReportInput) => ({
      ...resolveTraceMetadata(input),
      intake: summarizeApplicationFields(input.intake),
      extraction: summarizeExtraction(input.extraction),
      warningCheck: summarizeWarningCheck(input.warningCheck),
      reportId: input.reportId ?? null,
      noPersistence: true
    }),
    processOutputs: (output: VerificationReport) =>
      summarizeVerificationReport(output),
    tags: ['ttb', 'llm', 'review-report', 'privacy-safe']
  }
);

const tracedReviewSurface = traceable(
  async (input: TracedReviewSurfaceInput): Promise<ReviewSurfaceTraceResult> => {
    annotateCurrentRun(input);
    const startedAt = performance.now();
    const extractionStage = await measureStage(() => runTracedReviewExtraction(input));
    const warningStage = await measureStage(() =>
      tracedWarningValidation({
        ...input,
        extraction: extractionStage.result
      })
    );
    const reportStage = await measureStage(() =>
      tracedReviewReport({
        ...input,
        extraction: extractionStage.result,
        warningCheck: warningStage.result,
        reportId: input.reportId
      })
    );

    return {
      report: reportStage.result,
      warningCheck: warningStage.result,
      stageTimingsMs: {
        extraction: extractionStage.elapsedMs,
        warning: warningStage.elapsedMs,
        report: reportStage.elapsedMs,
        total: Math.round(performance.now() - startedAt)
      }
    };
  },
  {
    name: 'ttb.review_surface.execution',
    run_type: 'chain',
    processInputs: (input: TracedReviewSurfaceInput) => ({
      ...resolveTraceMetadata(input),
      label: summarizeLabel(input.intake),
      intake: summarizeApplicationFields(input.intake),
      reportId: input.reportId ?? null,
      noPersistence: true
    }),
    processOutputs: (output: ReviewSurfaceTraceResult) => ({
      report: summarizeVerificationReport(output.report),
      warningCheck: summarizeWarningCheck(output.warningCheck),
      stageTimingsMs: summarizeStageTimings(output.stageTimingsMs),
      noPersistence: true
    }),
    tags: ['ttb', 'llm', 'review-surface', 'privacy-safe']
  }
);

const tracedExtractionSurface = traceable(
  async (
    input: TracedExtractionSurfaceInput
  ): Promise<ExtractionSurfaceTraceResult> => {
    annotateCurrentRun(input);
    const startedAt = performance.now();
    const extractionStage = await measureStage(() => runTracedReviewExtraction(input));

    return {
      extraction: extractionStage.result,
      stageTimingsMs: {
        extraction: extractionStage.elapsedMs,
        total: Math.round(performance.now() - startedAt)
      }
    };
  },
  {
    name: 'ttb.extraction_surface.execution',
    run_type: 'chain',
    processInputs: (input: TracedExtractionSurfaceInput) => ({
      ...resolveTraceMetadata(input),
      label: summarizeLabel(input.intake),
      intake: summarizeApplicationFields(input.intake),
      noPersistence: true
    }),
    processOutputs: (output: ExtractionSurfaceTraceResult) => ({
      extraction: summarizeExtraction(output.extraction),
      stageTimingsMs: summarizeStageTimings(output.stageTimingsMs),
      noPersistence: true
    }),
    tags: ['ttb', 'llm', 'extraction-surface', 'privacy-safe']
  }
);

const tracedWarningSurface = traceable(
  async (input: TracedWarningSurfaceInput): Promise<WarningSurfaceTraceResult> => {
    annotateCurrentRun(input);
    const startedAt = performance.now();
    const extractionStage = await measureStage(() => runTracedReviewExtraction(input));
    const warningStage = await measureStage(() =>
      tracedWarningValidation({
        ...input,
        extraction: extractionStage.result
      })
    );

    return {
      extraction: extractionStage.result,
      warningCheck: warningStage.result,
      stageTimingsMs: {
        extraction: extractionStage.elapsedMs,
        warning: warningStage.elapsedMs,
        total: Math.round(performance.now() - startedAt)
      }
    };
  },
  {
    name: 'ttb.warning_surface.execution',
    run_type: 'chain',
    processInputs: (input: TracedWarningSurfaceInput) => ({
      ...resolveTraceMetadata(input),
      label: summarizeLabel(input.intake),
      intake: summarizeApplicationFields(input.intake),
      noPersistence: true
    }),
    processOutputs: (output: WarningSurfaceTraceResult) => ({
      extraction: summarizeExtraction(output.extraction),
      warningCheck: summarizeWarningCheck(output.warningCheck),
      stageTimingsMs: summarizeStageTimings(output.stageTimingsMs),
      noPersistence: true
    }),
    tags: ['ttb', 'llm', 'warning-surface', 'privacy-safe']
  }
);

export async function runTracedReviewExtraction(
  input: TracedReviewExtractionInput
) {
  return await tracedReviewExtraction(input);
}

export async function runTracedReviewSurface(input: TracedReviewSurfaceInput) {
  const result = await tracedReviewSurface(input);
  return result.report;
}

export async function runTracedExtractionSurface(
  input: TracedExtractionSurfaceInput
) {
  const result = await tracedExtractionSurface(input);
  return result.extraction;
}

export async function runTracedWarningSurface(input: TracedWarningSurfaceInput) {
  const result = await tracedWarningSurface(input);
  return result.warningCheck;
}
