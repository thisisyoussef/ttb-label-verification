import type { ReviewError } from '../shared/contracts/review';
import type { ExtractionMode } from './ai-provider-policy';
import type { LlmEndpointSurface } from './llm-policy';
import {
  reviewExtractionModelOutputSchema,
  type ReviewExtractionModelOutputSchema
} from './review-extraction-model-output';

type GuardrailOutput = ReviewExtractionModelOutputSchema;

type GuardrailSuccess = {
  success: true;
  value: GuardrailOutput;
};

type GuardrailFailure = {
  success: false;
  status: number;
  error: ReviewError;
};

export type ReviewExtractorGuardrailResult =
  | GuardrailSuccess
  | GuardrailFailure;

export function applyReviewExtractorGuardrails(input: {
  surface: LlmEndpointSurface;
  extractionMode: ExtractionMode;
  output: GuardrailOutput;
}): ReviewExtractorGuardrailResult {
  let guarded = structuredClone(input.output);

  if (isContradictoryNoTextOutput(guarded)) {
    guarded = sanitizeNoTextOutput(guarded);
  }

  guarded = downgradeWarningSignalsWithoutWarningText(guarded);

  if (input.extractionMode === 'local') {
    guarded = downgradeLocalOnlyVisualClaims(guarded);
  }

  return {
    success: true,
    value: reviewExtractionModelOutputSchema.parse(guarded)
  };
}

function isContradictoryNoTextOutput(output: GuardrailOutput) {
  if (!output.imageQuality.noTextDetected) {
    return false;
  }

  const hasPresentFields = Object.entries(output.fields).some(([fieldId, value]) => {
    if (fieldId === 'varietals') {
      return Array.isArray(value) && value.length > 0;
    }

    return !Array.isArray(value) && value.present;
  });

  const hasAssertiveWarningSignals = Object.values(output.warningSignals).some(
    (signal) => signal.status !== 'uncertain'
  );

  return hasPresentFields || hasAssertiveWarningSignals;
}

function downgradeWarningSignalsWithoutWarningText(output: GuardrailOutput) {
  if (output.fields.governmentWarning.present) {
    return output;
  }

  const downgradedSignals = Object.fromEntries(
    Object.entries(output.warningSignals).map(([signalId, signal]) => [
      signalId,
      signal.status === 'uncertain'
        ? signal
        : {
            status: 'uncertain' as const,
            confidence: Math.min(signal.confidence, 0.35),
            note: appendNote(
              signal.note,
              'Downgraded because warning text was not extracted from the label.'
            )
          }
    ])
  ) as GuardrailOutput['warningSignals'];

  return {
    ...output,
    warningSignals: downgradedSignals
  };
}

function sanitizeNoTextOutput(output: GuardrailOutput): GuardrailOutput {
  const emptiedField = {
    present: false,
    value: null,
    confidence: 0.12,
    note: 'Guardrail sanitized contradictory no-text output.'
  };
  const uncertainSignal = {
    status: 'uncertain' as const,
    confidence: 0.2,
    note: 'Guardrail downgraded visual certainty because no readable text was detected.'
  };

  return {
    ...output,
    beverageTypeHint: null,
    fields: {
      brandName: emptiedField,
      fancifulName: emptiedField,
      classType: emptiedField,
      alcoholContent: emptiedField,
      netContents: emptiedField,
      applicantAddress: emptiedField,
      countryOfOrigin: emptiedField,
      ageStatement: emptiedField,
      sulfiteDeclaration: emptiedField,
      appellation: emptiedField,
      vintage: emptiedField,
      governmentWarning: emptiedField,
      varietals: []
    },
    warningSignals: {
      prefixAllCaps: uncertainSignal,
      prefixBold: uncertainSignal,
      continuousParagraph: uncertainSignal,
      separateFromOtherContent: uncertainSignal
    },
    summary: 'Guardrail downgraded contradictory no-text output to explicit uncertainty.'
  };
}

function downgradeLocalOnlyVisualClaims(output: GuardrailOutput) {
  return {
    ...output,
    warningSignals: {
      ...output.warningSignals,
      prefixBold: downgradeSignal(output.warningSignals.prefixBold),
      continuousParagraph: downgradeSignal(
        output.warningSignals.continuousParagraph
      ),
      separateFromOtherContent: downgradeSignal(
        output.warningSignals.separateFromOtherContent
      )
    }
  };
}

function downgradeSignal(signal: GuardrailOutput['warningSignals']['prefixBold']) {
  if (signal.status === 'uncertain') {
    return signal;
  }

  return {
    status: 'uncertain' as const,
    confidence: Math.min(signal.confidence, 0.35),
    note: appendNote(
      signal.note,
      'Downgraded in local mode because formatting or spatial judgments are not trusted strongly enough.'
    )
  };
}

function appendNote(note: string | null, suffix: string) {
  if (!note || note.trim().length === 0) {
    return suffix;
  }

  return `${note} ${suffix}`;
}
