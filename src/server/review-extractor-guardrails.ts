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
  guarded = scrubUrlFromApplicantAddress(guarded);
  guarded = scrubLocationOnlyApplicantAddress(guarded);

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

/**
 * Guardrail: the applicant-address field is strictly the bottler /
 * importer POSTAL address (27 CFR §§ 4.35, 5.63, 7.24 — "name and
 * address of the bottler / packer"). In practice the VLM sometimes
 * returns a web URL or social handle instead, because a marketing
 * URL on the label is semantically an "address" too. Downstream
 * judgment then flags it as a mismatch against the actual applicant
 * street address — a noisy false-negative.
 *
 * Catch URL-shaped values before they leave the extractor and
 * downgrade the field to `present=false`. A human-readable note
 * explains the reason in the evidence panel.
 *
 * Conservative matcher: only reject values that are OVERWHELMINGLY
 * URL-ish (scheme, mandatory slash sequence, or an www/domain-only
 * pattern). Don't reject strings that happen to contain a .com — a
 * legitimate postal address like "100 Main St., Anytown, VA 22314,
 * www.example.com" has real value we want to preserve; the addr-
 * comparison layer tokenizes such strings and matches against the
 * actual postal fields.
 */
function scrubUrlFromApplicantAddress(output: GuardrailOutput): GuardrailOutput {
  const addr = output.fields.applicantAddress;
  if (!addr.present || !addr.value) return output;
  if (!isUrlOnlyAddress(addr.value)) return output;

  return {
    ...output,
    fields: {
      ...output.fields,
      applicantAddress: {
        present: false,
        value: null,
        confidence: Math.min(addr.confidence, 0.2),
        note: appendNote(
          addr.note,
          'Rejected: extracted value was a URL / web address, not a postal address.'
        )
      }
    }
  };
}

/**
 * Guardrail: if the extractor assigns applicantAddress to the exact same
 * bare geography it already assigned to countryOfOrigin or appellation,
 * treat that as a location overcall rather than a real bottler/importer
 * line. This protects dark or low-contrast labels where the model can
 * correctly see a place name but mis-slot it as an address.
 */
function scrubLocationOnlyApplicantAddress(
  output: GuardrailOutput
): GuardrailOutput {
  const addr = output.fields.applicantAddress;
  if (!addr.present || !addr.value) return output;

  const normalizedAddress = normalizeComparableLocation(addr.value);
  if (!normalizedAddress) return output;

  const locationCandidates = [
    output.fields.countryOfOrigin,
    output.fields.appellation
  ]
    .map((field) => {
      if (!field.present || typeof field.value !== 'string') {
        return '';
      }

      if (field.value.trim().length === 0) {
        return '';
      }

      return normalizeComparableLocation(field.value);
    })
    .filter((value): value is string => value.length > 0);

  if (!locationCandidates.includes(normalizedAddress)) {
    return output;
  }

  return {
    ...output,
    fields: {
      ...output.fields,
      applicantAddress: {
        present: false,
        value: null,
        confidence: Math.min(addr.confidence, 0.2),
        note: appendNote(
          addr.note,
          'Rejected: extracted value matched a geography/appellation field rather than a bottler/importer name or postal address.'
        )
      }
    }
  };
}

/**
 * True when the input is recognizably a URL / web address with no
 * co-located postal information. Intentionally strict so we don't
 * discard real addresses that happen to end with a marketing URL.
 */
export function isUrlOnlyAddress(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;

  // Obvious URL schemes.
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^ftp:\/\//i.test(trimmed)) return true;

  // www.* followed by a domain and no spaces (www.example.com, etc.).
  if (/^www\.[a-z0-9-]+\.[a-z]{2,}(\/\S*)?$/i.test(trimmed)) return true;

  // Bare domain only (example.com, my-brewery.beer, example.co.uk).
  // No spaces means there's no room for a postal address, and the
  // trailing TLD distinguishes it from plain words. Matches one or
  // more dot-separated segments ending in a 2+ char alpha TLD.
  if (
    !trimmed.includes(' ') &&
    /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(trimmed)
  ) {
    return true;
  }

  // Social handles / emails where the @ is the whole value.
  if (/^[@#][a-z0-9._-]+$/i.test(trimmed)) return true;
  if (/^[a-z0-9._-]+@[a-z0-9-]+(\.[a-z]{2,})+$/i.test(trimmed)) return true;

  return false;
}

function normalizeComparableLocation(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function appendNote(note: string | null, suffix: string) {
  if (!note || note.trim().length === 0) {
    return suffix;
  }

  return `${note} ${suffix}`;
}
