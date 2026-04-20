import { getCurrentRunTree } from '../trace-runtime';

import type {
  CheckReview,
  ReviewExtraction,
  VerificationReport
} from '../../shared/contracts/review';
import type { ExtractionMode } from './ai-provider-policy';
import {
  type LlmEndpointSurface,
  REVIEW_EXTRACTION_MODE,
  REVIEW_EXTRACTION_PROVIDER
} from './llm-policy';
import { resolveReviewPromptPolicy } from '../review/review-prompt-policy';
import type { NormalizedReviewIntake } from '../review/review-intake';
import {
  createReviewLatencyCapture,
  emitReviewLatencySummary,
  type ReviewLatencyCapture,
  type ReviewLatencyObserver,
  type ReviewLatencySummary
} from '../review/review-latency';

export type TraceMetadataInput = {
  surface: LlmEndpointSurface;
  extractionMode?: ExtractionMode;
  clientTraceId?: string;
  fixtureId?: string;
  provider?: string;
  promptProfile?: string;
  guardrailPolicy?: string;
};

export type TraceStageTimings = {
  extraction: number;
  warning?: number;
  report?: number;
  total: number;
};

export function resolveTraceMetadata(input: TraceMetadataInput) {
  const extractionMode = input.extractionMode ?? REVIEW_EXTRACTION_MODE;
  const promptPolicy = resolveReviewPromptPolicy({
    surface: input.surface,
    extractionMode
  });

  return {
    surface: input.surface,
    extractionMode,
    provider: input.provider ?? REVIEW_EXTRACTION_PROVIDER,
    promptProfile: input.promptProfile ?? promptPolicy.promptProfile,
    guardrailPolicy: input.guardrailPolicy ?? promptPolicy.guardrailPolicy,
    clientTraceId: input.clientTraceId ?? null,
    fixtureId: input.fixtureId ?? null
  };
}

export function annotateCurrentRun(input: TraceMetadataInput) {
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

export function inferProviderFromModel(model: string) {
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

export function summarizeApplicationFields(intake: NormalizedReviewIntake) {
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

export function summarizeLabel(intake: NormalizedReviewIntake) {
  return {
    mimeType: intake.label.mimeType,
    bytes: intake.label.bytes,
    isPdf: intake.label.mimeType === 'application/pdf'
  };
}

export function summarizeExtraction(extraction: ReviewExtraction) {
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

export function summarizeWarningCheck(warningCheck: CheckReview) {
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

export function summarizeVerificationReport(report: VerificationReport) {
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

export function summarizeStageTimings(stageTimingsMs: TraceStageTimings) {
  return {
    extraction: stageTimingsMs.extraction,
    warning: stageTimingsMs.warning ?? null,
    report: stageTimingsMs.report ?? null,
    total: stageTimingsMs.total
  };
}

export function summarizeLatencySummary(summary: ReviewLatencySummary) {
  return summary;
}

export async function measureStage<T>(runner: () => Promise<T>) {
  const startedAt = performance.now();
  const result = await runner();

  return {
    result,
    elapsedMs: Math.round(performance.now() - startedAt)
  };
}

export function resolveLatencyCapture(input: {
  surface: LlmEndpointSurface;
  clientTraceId?: string;
  fixtureId?: string;
  latencyCapture?: ReviewLatencyCapture;
}) {
  return (
    input.latencyCapture ??
    createReviewLatencyCapture({
      surface: input.surface,
      clientTraceId: input.clientTraceId,
      fixtureId: input.fixtureId
    })
  );
}

export function resolveSuccessLatencyPath(capture: ReviewLatencyCapture) {
  const existingPath = capture.getOutcomePath();
  if (existingPath) {
    return existingPath;
  }

  return capture.hasFallbackAttempt()
    ? 'fast-fail-fallback-success'
    : 'primary-success';
}

export function finalizeFailureLatency(input: {
  surface: LlmEndpointSurface;
  clientTraceId?: string;
  fixtureId?: string;
  latencyCapture?: ReviewLatencyCapture;
  latencyObserver?: ReviewLatencyObserver;
}) {
  const latencyCapture = resolveLatencyCapture(input);
  if (!latencyCapture.getOutcomePath()) {
    latencyCapture.setOutcomePath('primary-hard-fail');
  }
  emitReviewLatencySummary(latencyCapture, input.latencyObserver);
}
