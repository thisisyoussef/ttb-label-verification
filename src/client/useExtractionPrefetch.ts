import { useCallback, useEffect, useRef, useState } from 'react';

import type { ReviewRelevanceResult } from '../shared/contracts/review';
import { checkReviewRelevance, prefetchExtraction } from './appReviewApi';
import type { BeverageSelection, LabelImage } from './types';

/**
 * Image-first prefetch: as soon as the user picks an image, fire the
 * server-side extract-only call so the full VLM extraction runs during
 * form-filling time instead of during the Verify click.
 *
 * On Verify, useSingleReviewFlow passes the stored cacheKey on the
 * /api/review request; server skips re-extraction and runs only
 * judgment + report. A user who spends >5s on the form sees Verify
 * complete in <1s.
 *
 * Safe to abort mid-flight if the user swaps images or clears — the
 * server-side pipeline will still finish (and populate its cache), but
 * the client stops listening.
 */

export interface ExtractionPrefetchHandle {
  /** Cache key returned by the server; pass this to submitReview. */
  cacheKey: string | null;
  /** Quick relevance result for the currently selected image(s). */
  relevance: ReviewRelevanceResult | null;
  /** True while the lightweight relevance scan is running. */
  relevancePending: boolean;
  /** Fire a prefetch for the given image. Aborts any in-flight call. */
  start: (
    image: LabelImage,
    secondaryImage: LabelImage | null,
    beverage: BeverageSelection
  ) => void;
  /** Abort and clear the cached key. Called on image change / reset. */
  reset: () => void;
}

export function useExtractionPrefetch(options: {
  enabled?: boolean;
} = {}): ExtractionPrefetchHandle {
  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const [relevance, setRelevance] = useState<ReviewRelevanceResult | null>(null);
  const [relevancePending, setRelevancePending] = useState(false);
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
    setCacheKey(null);
    setRelevance(null);
    setRelevancePending(false);
  }, []);

  const start = useCallback<ExtractionPrefetchHandle['start']>(
    (image, secondaryImage, beverage) => {
      if (!enabled) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setCacheKey(null);
      setRelevance(null);
      setRelevancePending(true);

      checkReviewRelevance({
        image,
        secondaryImage,
        beverage,
        signal: controller.signal
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          setRelevance(result);
          if (!result) {
            return prefetchExtraction({
              image,
              secondaryImage,
              beverage,
              signal: controller.signal
            });
          }
          if (!result.shouldPrefetchExtraction) {
            return;
          }
          return prefetchExtraction({
            image,
            secondaryImage,
            beverage,
            signal: controller.signal
          });
        })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (result?.cacheKey) setCacheKey(result.cacheKey);
        })
        .catch(() => {
          // Prefetch failures are silent — canonical /api/review still
          // runs a cold extraction if the cache key is missing.
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setRelevancePending(false);
        });
    },
    [enabled]
  );

  return { cacheKey, relevance, relevancePending, start, reset };
}
