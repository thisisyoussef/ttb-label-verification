import { useCallback, useEffect, useRef } from 'react';

import { submitReview } from './appReviewApi';
import { logReviewClientEvent } from './review-observability';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  UIVerificationReport
} from './types';

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------

/** Deterministic key for comparing prefetch inputs to verify-time inputs. */
export function buildInputFingerprint(
  image: LabelImage,
  secondaryImage: LabelImage | null,
  beverage: BeverageSelection,
  fields: IntakeFields
): string {
  return JSON.stringify({
    fn: image.file.name,
    fs: image.file.size,
    fm: image.file.lastModified,
    ft: image.file.type,
    sfn: secondaryImage?.file.name ?? null,
    sfs: secondaryImage?.file.size ?? null,
    sfm: secondaryImage?.file.lastModified ?? null,
    sft: secondaryImage?.file.type ?? null,
    bv: beverage,
    bn: fields.brandName,
    fa: fields.fancifulName,
    ct: fields.classType,
    ac: fields.alcoholContent,
    nc: fields.netContents,
    aa: fields.applicantAddress,
    or: fields.origin,
    co: fields.country,
    fi: fields.formulaId,
    ap: fields.appellation,
    vi: fields.vintage,
    va: fields.varietals.map((r) => [r.name, r.percentage])
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrefetchCacheEntry {
  fingerprint: string;
  report: UIVerificationReport;
  completedAt: number;
}

export interface SpeculativePrefetchHandle {
  consumeCacheHit: (
    image: LabelImage,
    secondaryImage: LabelImage | null,
    beverage: BeverageSelection,
    fields: IntakeFields
  ) => PrefetchCacheEntry | null;
  clearPrefetch: () => void;
}

const DEBOUNCE_MS = 1500;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSpeculativePrefetch(options: {
  enabled: boolean;
  image: LabelImage | null;
  secondaryImage: LabelImage | null;
  beverage: BeverageSelection;
  fields: IntakeFields;
  forceFailure: boolean;
}): SpeculativePrefetchHandle {
  const cacheRef = useRef<PrefetchCacheEntry | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  const debounceRef = useRef<number | null>(null);

  // -- helpers --------------------------------------------------------------

  const clearDebounce = useCallback(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const clearPrefetch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    cacheRef.current = null;
    idRef.current += 1;
    clearDebounce();
  }, [clearDebounce]);

  // -- fire -----------------------------------------------------------------

  const firePrefetch = useCallback(
    (
      image: LabelImage,
      secondaryImage: LabelImage | null,
      beverage: BeverageSelection,
      fields: IntakeFields
    ) => {
      abortRef.current?.abort();
      cacheRef.current = null;

      idRef.current += 1;
      const prefetchId = idRef.current;
      const fingerprint = buildInputFingerprint(image, secondaryImage, beverage, fields);
      const controller = new AbortController();
      abortRef.current = controller;

      logReviewClientEvent('review.prefetch.started', { fingerprint, prefetchId });

      submitReview({
        image,
        secondaryImage,
        beverage,
        fields,
        signal: controller.signal
      })
        .then((result) => {
          if (prefetchId !== idRef.current) return;
          if (result.ok) {
            cacheRef.current = {
              fingerprint,
              report: result.report,
              completedAt: Date.now()
            };
            logReviewClientEvent('review.prefetch.completed', {
              fingerprint,
              prefetchId,
              reportId: result.report.id
            });
          } else {
            logReviewClientEvent('review.prefetch.failed', {
              fingerprint,
              prefetchId,
              message: result.message
            });
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            logReviewClientEvent('review.prefetch.aborted', {
              fingerprint,
              prefetchId
            });
            return;
          }
          logReviewClientEvent('review.prefetch.failed', {
            fingerprint,
            prefetchId,
            message: error instanceof Error ? error.message : 'unknown'
          });
        });
    },
    []
  );

  // -- Effect 1: fire on image change (immediate) --------------------------

  const imageIdentity = options.image?.file;
  const secondaryImageIdentity = options.secondaryImage?.file;

  useEffect(() => {
    if (!options.enabled || !options.image || options.forceFailure) {
      clearPrefetch();
      return;
    }
    firePrefetch(
      options.image,
      options.secondaryImage,
      options.beverage,
      options.fields
    );
    // Intentionally narrow deps: only re-fire when the image identity changes.
    // beverage/fields changes are handled by Effect 2 with debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageIdentity, secondaryImageIdentity, options.enabled, options.forceFailure]);

  // -- Effect 2: re-fire on beverage/fields change (debounced) -------------

  const beverageRef = useRef(options.beverage);
  const fieldsRef = useRef(options.fields);
  beverageRef.current = options.beverage;
  fieldsRef.current = options.fields;

  const imageRef = useRef(options.image);
  imageRef.current = options.image;
  const secondaryImageRef = useRef(options.secondaryImage);
  secondaryImageRef.current = options.secondaryImage;

  useEffect(() => {
    if (!options.enabled || !options.image || options.forceFailure) return;

    clearDebounce();

    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      const img = imageRef.current;
      if (!img) return;
      const secondaryImg = secondaryImageRef.current;
      const fp = buildInputFingerprint(
        img,
        secondaryImg,
        beverageRef.current,
        fieldsRef.current
      );
      if (cacheRef.current?.fingerprint === fp) return;
      firePrefetch(img, secondaryImg, beverageRef.current, fieldsRef.current);
    }, DEBOUNCE_MS);

    return clearDebounce;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.beverage, options.fields, options.enabled, options.forceFailure]);

  // -- cleanup on unmount ---------------------------------------------------

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearDebounce();
    };
  }, [clearDebounce]);

  // -- public API -----------------------------------------------------------

  const consumeCacheHit = useCallback(
    (
      image: LabelImage,
      secondaryImage: LabelImage | null,
      beverage: BeverageSelection,
      fields: IntakeFields
    ): PrefetchCacheEntry | null => {
      const entry = cacheRef.current;
      if (!entry) {
        logReviewClientEvent('review.prefetch.cache-miss', { reason: 'none' });
        return null;
      }

      const currentFp = buildInputFingerprint(image, secondaryImage, beverage, fields);
      if (entry.fingerprint !== currentFp) {
        logReviewClientEvent('review.prefetch.cache-miss', { reason: 'stale' });
        return null;
      }

      // Single-use: consume and clear.
      cacheRef.current = null;
      abortRef.current?.abort();
      abortRef.current = null;

      logReviewClientEvent('review.prefetch.cache-hit', {
        fingerprint: entry.fingerprint,
        reportId: entry.report.id,
        latencySavedMs: Date.now() - entry.completedAt
      });

      return entry;
    },
    []
  );

  return { consumeCacheHit, clearPrefetch };
}
