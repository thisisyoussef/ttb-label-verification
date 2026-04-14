import { traceable } from 'langsmith/traceable';

import type { ReviewExtraction } from '../shared/contracts/review';
import {
  REVIEW_EXTRACTION_GUARDRAIL_POLICY,
  REVIEW_EXTRACTION_MODE,
  REVIEW_EXTRACTION_PROMPT_PROFILE,
  REVIEW_EXTRACTION_PROVIDER,
  type LlmEndpointSurface
} from './llm-policy';
import type { NormalizedReviewIntake } from './review-intake';
import type { ReviewExtractor } from './review-extraction';

type TracedReviewExtractionInput = {
  surface: LlmEndpointSurface;
  extractionMode?: string;
  intake: NormalizedReviewIntake;
  extractor: ReviewExtractor;
  fixtureId?: string;
  provider?: string;
  promptProfile?: string;
  guardrailPolicy?: string;
};

type TracedReviewExtractionOutput = ReturnType<typeof summarizeExtraction>;

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
      .map(([fieldId]) => fieldId),
    varietalCount: intake.fields.varietals.length
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

const tracedReviewExtraction = traceable(
  async (input: TracedReviewExtractionInput) => input.extractor(input.intake),
  {
  name: 'ttb.review_extraction.surface',
  run_type: 'chain',
  processInputs: (input: TracedReviewExtractionInput) => ({
    endpointSurface: input.surface,
    extractionMode: input.extractionMode ?? REVIEW_EXTRACTION_MODE,
    provider: input.provider ?? REVIEW_EXTRACTION_PROVIDER,
    promptProfile: input.promptProfile ?? REVIEW_EXTRACTION_PROMPT_PROFILE,
    guardrailPolicy:
      input.guardrailPolicy ?? REVIEW_EXTRACTION_GUARDRAIL_POLICY,
    fixtureId: input.fixtureId ?? null,
    label: {
      mimeType: input.intake.label.mimeType,
      originalName: input.intake.label.originalName,
      bytes: input.intake.label.bytes
    },
    intake: summarizeApplicationFields(input.intake),
    noPersistence: true
  }),
  processOutputs: (output: ReviewExtraction): TracedReviewExtractionOutput =>
    summarizeExtraction(output),
  tags: ['ttb', 'llm', 'review-extraction', 'privacy-safe']
});

export async function runTracedReviewExtraction(
  input: TracedReviewExtractionInput
) {
  return await tracedReviewExtraction(input);
}
