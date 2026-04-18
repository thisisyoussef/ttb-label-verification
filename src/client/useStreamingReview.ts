import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  PartialReviewExtraction,
  ReviewStreamFrame,
  VerificationReport,
  WarningEvidence
} from '../shared/contracts/review';
import { streamReview } from './appReviewApi';
import type { BeverageSelection, IntakeFields, LabelImage } from './types';

/**
 * Progressive review state that grows as SSE frames arrive from
 * `/api/review/stream`. Consumers render a skeleton when `stage` is
 * `'intake'` or earlier, fill in numeric / canonical fields from
 * `partialExtraction` at `'ocr-done'`, and transition to the full
 * Results panel when `report` lands at `'report-ready'`.
 *
 * This hook is the client half of the Option A + D MVP: it surfaces
 * every stage as soon as the server emits it so the UI can show "we
 * found the ABV + net contents" in ~1-2s while the VLM is still
 * running. Full per-field VLM streaming is a follow-up.
 */

export type StreamingReviewStage =
  | 'idle'
  | 'intake'
  | 'ocr-done'
  | 'vlm-done'
  | 'warning-done'
  | 'report-ready'
  | 'error';

export interface StreamingReviewState {
  stage: StreamingReviewStage;
  requestId: string | null;
  partialExtraction: PartialReviewExtraction;
  warning: WarningEvidence | null;
  report: VerificationReport | null;
  error: { message: string; retryable: boolean } | null;
}

const INITIAL_STATE: StreamingReviewState = {
  stage: 'idle',
  requestId: null,
  partialExtraction: {},
  warning: null,
  report: null,
  error: null
};

export interface UseStreamingReviewOptions {
  clientRequestId?: string;
}

export interface StreamingReviewHandle {
  state: StreamingReviewState;
  /** Kicks off a streaming review. Rejects any in-flight request. */
  start: (input: {
    image: LabelImage;
    secondaryImage?: LabelImage | null;
    beverage: BeverageSelection;
    fields: IntakeFields;
  }) => void;
  /** Aborts the in-flight request and resets to idle. */
  reset: () => void;
}

export function useStreamingReview(
  options: UseStreamingReviewOptions = {}
): StreamingReviewHandle {
  const [state, setState] = useState<StreamingReviewState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL_STATE);
  }, []);

  // Abort any in-flight request on unmount so we don't leak readers.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const start = useCallback<StreamingReviewHandle['start']>(
    (input) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ ...INITIAL_STATE, stage: 'intake' });

      // Fire-and-forget — we update React state via frame callback.
      streamReview({
        image: input.image,
        secondaryImage: input.secondaryImage,
        beverage: input.beverage,
        fields: input.fields,
        signal: controller.signal,
        clientRequestId: options.clientRequestId,
        onFrame: (frame) => {
          if (controller.signal.aborted) return;
          setState((prev) => applyFrame(prev, frame));
        }
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Streaming review failed.';
        setState((prev) => ({
          ...prev,
          stage: 'error',
          error: { message, retryable: true }
        }));
      });
    },
    [options.clientRequestId]
  );

  return { state, start, reset };
}

/**
 * Fold a single SSE frame into the streaming review state. Pure so
 * consumers can reuse the reducer in tests or custom flows.
 */
export function applyFrame(
  prev: StreamingReviewState,
  frame: ReviewStreamFrame
): StreamingReviewState {
  switch (frame.type) {
    case 'intake':
      return {
        ...prev,
        stage: 'intake',
        requestId: frame.requestId
      };
    case 'ocr-done': {
      const partial = { ...prev.partialExtraction };
      if (frame.ocrText) partial.ocrText = frame.ocrText;
      if (frame.partialFields.alcoholContent?.present) {
        partial.alcoholContent = frame.partialFields.alcoholContent;
      }
      if (frame.partialFields.netContents?.present) {
        partial.netContents = frame.partialFields.netContents;
      }
      if (frame.partialFields.classType?.present) {
        partial.classType = frame.partialFields.classType;
      }
      if (frame.partialFields.countryOfOrigin?.present) {
        partial.countryOfOrigin = frame.partialFields.countryOfOrigin;
      }
      if (frame.partialFields.governmentWarning?.present) {
        partial.governmentWarning = frame.partialFields.governmentWarning;
      }
      return {
        ...prev,
        stage: 'ocr-done',
        partialExtraction: partial
      };
    }
    case 'vlm-field': {
      const partial = { ...prev.partialExtraction };
      // Type-safely set the field on whichever extraction slot matches.
      // Unknown field names are silently ignored rather than throwing —
      // a future server schema bump shouldn't break this client.
      const key = frame.fieldName as keyof PartialReviewExtraction;
      if (key in partial || isExtractionFieldKey(key)) {
        (partial as Record<string, unknown>)[key] = frame.field;
      }
      return { ...prev, partialExtraction: partial };
    }
    case 'vlm-done':
      return { ...prev, stage: 'vlm-done' };
    case 'warning-done':
      return {
        ...prev,
        stage: prev.stage === 'report-ready' ? prev.stage : 'warning-done',
        warning: frame.warning
      };
    case 'report-ready':
      return {
        ...prev,
        stage: 'report-ready',
        report: frame.report
      };
    case 'error':
      return {
        ...prev,
        stage: 'error',
        error: { message: frame.message, retryable: frame.retryable }
      };
    case 'done':
      return prev;
    default: {
      // Exhaustiveness guard — frame is typed `never` here. A future
      // schema addition will surface as a compile-time error.
      const exhaustive: never = frame;
      void exhaustive;
      return prev;
    }
  }
}

function isExtractionFieldKey(key: string): boolean {
  return [
    'alcoholContent',
    'netContents',
    'brandName',
    'fancifulName',
    'classType',
    'countryOfOrigin',
    'applicantAddress',
    'ageStatement',
    'sulfiteDeclaration',
    'appellation',
    'vintage',
    'governmentWarning'
  ].includes(key);
}
