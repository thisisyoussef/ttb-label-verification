/**
 * Individual subCheck builders for the government-warning validator.
 *
 * Each subCheck evaluates one regulatory property (presence, exact text
 * match, heading formatting, continuous paragraph, legibility) and
 * returns a typed `WarningSubCheck` that the main validator aggregates
 * into a final CheckReview.
 *
 * See government-warning-validator.ts for how these are consumed.
 */

import type {
  ReviewExtraction,
  ReviewVisualSignal,
  WarningSubCheck
} from '../shared/contracts/review';

const WARNING_TEXT_CONFIDENCE_THRESHOLD = 0.8;
const WARNING_VISUAL_CONFIDENCE_THRESHOLD = 0.75;

export { WARNING_TEXT_CONFIDENCE_THRESHOLD, WARNING_VISUAL_CONFIDENCE_THRESHOLD };

export function buildPresenceSubCheck(input: {
  hasWarningText: boolean;
  textReliable: boolean;
}): WarningSubCheck {
  if (input.hasWarningText) {
    return {
      id: 'present',
      label: 'Warning text is present',
      status: 'pass',
      reason: 'Warning text is on the label.'
    };
  }

  return {
    id: 'present',
    label: 'Warning text is present',
    status: input.textReliable ? 'fail' : 'review',
    reason: input.textReliable
      ? 'No government warning was found on this label.'
      : 'The label image is too unclear to confirm whether the warning is there.'
  };
}

export function buildExactTextSubCheck(input: {
  hasWarningText: boolean;
  exactMatch: boolean;
  textReliable: boolean;
  similarity: number;
}): WarningSubCheck {
  if (!input.hasWarningText) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'review',
      reason:
        'Could not read the warning clearly enough to compare it to the required wording.'
    };
  }

  if (input.exactMatch && input.textReliable) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'pass',
      reason:
        'Warning text matches the required wording.'
    };
  }

  if (input.exactMatch) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'review',
      reason: 'Text matches, but the label image is hard to read. Please confirm.'
    };
  }

  // Fuzzy tiers match the OCV fast-path so both ingestion routes apply the
  // same "OCR noise vs real word substitution" distinction. A 90%+ match
  // is normal Tesseract/VLM noise on small-print warnings — pass. A 65-89%
  // match might be a real but minor wording issue — review. Below 65% is
  // a genuine content divergence — fail.
  if (input.similarity >= 0.9) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'pass',
      reason: `Warning text matches the required wording (${(input.similarity * 100).toFixed(0)}% match). Small differences are typical of reading small print.`
    };
  }
  if (input.similarity >= 0.65) {
    return {
      id: 'exact-text',
      label: 'Warning text matches required wording',
      status: 'review',
      reason: `Warning text mostly matches the required wording (${(input.similarity * 100).toFixed(0)}% match). A human reviewer should confirm.`
    };
  }

  return {
    id: 'exact-text',
    label: 'Warning text matches required wording',
    status: input.textReliable ? 'fail' : 'review',
    reason: input.textReliable
      ? 'Warning wording differs from the required text. See the diff below for exact changes.'
      : 'Warning wording appears to differ, but the label image is hard to read. A human reviewer should confirm.'
  };
}

export function buildHeadingSubCheck(input: {
  extractedText: string;
  prefixAllCaps: ReviewVisualSignal;
  prefixBold: ReviewVisualSignal;
  hasWarningText: boolean;
  textReliable: boolean;
}): WarningSubCheck {
  if (!input.hasWarningText) {
    return {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'review',
      reason: 'Could not read the heading clearly enough to check its formatting.'
    };
  }

  const prefixText = detectWarningPrefix(input.extractedText);
  // Accept the "GOVERNMENT WARNING" phrase anywhere near the start of the
  // extracted text, not only at position 0. Gemini Flash occasionally
  // reformats the extraction to lead with "(1) According to..." when the
  // on-label layout stacks the heading above the body; the heading is
  // still present in the image and in the extracted string, just not at
  // the start. Requiring position-0 match caused persistent false-fails
  // on those labels. The text still has to contain the phrase — and
  // `detectWarningPrefix` (position 0) still supplies the primary signal
  // when present, which lets the downstream bold/allcaps check engage.
  const headingAppearsInBody = /GOVERN(?:MENT)?\s*WARNING/i.test(
    input.extractedText.slice(0, 300)
  );
  const prefixHasExpectedWords =
    (prefixText.toUpperCase() === 'GOVERNMENT WARNING' && prefixText.length > 0) ||
    headingAppearsInBody;
  const prefixIsUppercase =
    prefixText.length === 0 ? headingAppearsInBody : prefixText === prefixText.toUpperCase();
  const allCapsSignal = summarizeVisualSignal(input.prefixAllCaps);
  const boldStatus = summarizeVisualSignal(input.prefixBold);

  if (
    prefixHasExpectedWords &&
    prefixIsUppercase &&
    allCapsSignal !== 'fail' &&
    boldStatus === 'pass' &&
    input.textReliable
  ) {
    return {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'pass',
      reason: 'Heading is all caps and bold.'
    };
  }

  if (!prefixHasExpectedWords || !prefixIsUppercase || allCapsSignal === 'fail') {
    return {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: input.textReliable ? 'fail' : 'review',
      reason: input.textReliable
        ? 'Heading is not all caps.'
        : 'Could not confirm the heading is all caps because the label image is hard to read.'
    };
  }

  if (boldStatus === 'fail') {
    return {
      id: 'uppercase-bold-heading',
      label: 'Warning heading is uppercase and bold',
      status: 'fail',
      reason: 'The heading does not appear bold.'
    };
  }

  return {
    id: 'uppercase-bold-heading',
    label: 'Warning heading is uppercase and bold',
    status: 'review',
    reason:
      'Heading is all caps, but it is hard to tell whether it is bold in this image.'
  };
}

export function buildContinuousParagraphSubCheck(input: {
  signal: ReviewVisualSignal;
  hasWarningText: boolean;
}): WarningSubCheck {
  if (!input.hasWarningText) {
    return {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'review',
      reason: 'Could not read the warning clearly enough to check if it reads as one paragraph.'
    };
  }

  const status = summarizeVisualSignal(input.signal);

  if (status === 'pass') {
    return {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'pass',
      reason: 'Warning reads as one paragraph.'
    };
  }

  if (status === 'fail') {
    return {
      id: 'continuous-paragraph',
      label: 'Warning is a continuous paragraph',
      status: 'fail',
      reason: 'The warning looks split or broken up on the label.'
    };
  }

  return {
    id: 'continuous-paragraph',
    label: 'Warning is a continuous paragraph',
    status: 'review',
    reason: 'Hard to tell whether the warning reads as one paragraph in this image.'
  };
}

export function buildLegibilitySubCheck(input: {
  extraction: ReviewExtraction;
  hasWarningText: boolean;
}): WarningSubCheck {
  const signalStatus = summarizeVisualSignal(
    input.extraction.warningSignals.separateFromOtherContent
  );

  if (!input.hasWarningText) {
    return {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'review',
      reason:
        'Could not read the warning clearly enough to check if it is readable and set apart.'
    };
  }

  if (input.extraction.imageQuality.state !== 'ok') {
    return {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'review',
      reason: 'The label image is hard to read, so we cannot confirm the warning is legible.'
    };
  }

  if (signalStatus === 'fail') {
    return {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'fail',
      reason: 'Warning does not appear separate from surrounding label content.'
    };
  }

  if (signalStatus === 'review') {
    return {
      id: 'legibility',
      label: 'Warning is legible at label size',
      status: 'review',
      reason: 'Hard to tell whether the warning stands apart from other content.'
    };
  }

  return {
    id: 'legibility',
    label: 'Warning is legible at label size',
    status: 'pass',
    reason: 'Warning is readable and stands apart from nearby text.'
  };
}
export function isTextReliable(extraction: ReviewExtraction) {
  return (
    extraction.fields.governmentWarning.confidence >=
      WARNING_TEXT_CONFIDENCE_THRESHOLD && extraction.imageQuality.state === 'ok'
  );
}

function summarizeVisualSignal(signal: ReviewVisualSignal) {
  if (signal.confidence < WARNING_VISUAL_CONFIDENCE_THRESHOLD) {
    return 'review' as const;
  }

  if (signal.status === 'yes') {
    return 'pass' as const;
  }

  if (signal.status === 'no') {
    return 'fail' as const;
  }

  return 'review' as const;
}

function detectWarningPrefix(value: string) {
  const match = value.match(/^[A-Za-z ]+(?=[:.])/);
  return match ? match[0].trim() : '';
}
