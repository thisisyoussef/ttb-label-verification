import { useCallback, useEffect, useRef, useState } from 'react';

import type { ReviewExtractionField } from '../shared/contracts/review';
import { streamReview } from './appReviewApi';
import type { BeverageSelection, IntakeFields, LabelImage } from './types';

/**
 * Fires a low-cost OCR-only preview alongside the canonical review
 * call. Server runs only Tesseract + regex extraction — no VLM. Users
 * see "we found ABV: 40%, net: 750 mL" in ~500ms while the full
 * review (which takes 5-7s) is still in flight.
 *
 * This hook is stateless relative to the canonical pipeline — it
 * never modifies the final report or verdict, only surfaces partial
 * field values for the Processing screen to render.
 */

export interface OcrPreviewFields {
  alcoholContent?: string;
  netContents?: string;
  classType?: string;
  countryOfOrigin?: string;
  governmentWarningPresent?: boolean;
}

export interface OcrPreviewHandle {
  preview: OcrPreviewFields | null;
  /** Start the preview call. Cancels any in-flight call. */
  start: (input: {
    image: LabelImage;
    beverage: BeverageSelection;
    fields: IntakeFields;
  }) => void;
  /** Abort and clear. */
  reset: () => void;
}

const NULL_PREVIEW: OcrPreviewFields | null = null;

export function useOcrPreview(options: { enabled?: boolean } = {}): OcrPreviewHandle {
  const [preview, setPreview] = useState<OcrPreviewFields | null>(NULL_PREVIEW);
  const abortRef = useRef<AbortController | null>(null);
  const enabled = options.enabled ?? true;

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPreview(NULL_PREVIEW);
  }, []);

  const start = useCallback<OcrPreviewHandle['start']>(
    (input) => {
      if (!enabled) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setPreview(NULL_PREVIEW);

      streamReview({
        image: input.image,
        beverage: input.beverage,
        fields: input.fields,
        signal: controller.signal,
        onlyOcr: true,
        onFrame: (frame) => {
          if (controller.signal.aborted) return;
          if (frame.type === 'ocr-done') {
            setPreview({
              alcoholContent: fieldValue(frame.partialFields.alcoholContent),
              netContents: fieldValue(frame.partialFields.netContents),
              classType: fieldValue(frame.partialFields.classType),
              countryOfOrigin: fieldValue(frame.partialFields.countryOfOrigin),
              governmentWarningPresent:
                frame.partialFields.governmentWarning?.present ?? false
            });
          }
        }
      }).catch(() => {
        // Preview failures are non-fatal — the canonical review still
        // runs in parallel and delivers the authoritative result.
        // Silent drop.
      });
    },
    [enabled]
  );

  return { preview, start, reset };
}

function fieldValue(field: ReviewExtractionField | undefined): string | undefined {
  if (!field?.present || !field.value || field.value.trim().length === 0) return undefined;
  return field.value.trim();
}
