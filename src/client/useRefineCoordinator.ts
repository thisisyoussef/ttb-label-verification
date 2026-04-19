import { useCallback, useRef, type RefObject } from 'react';

import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  UIVerificationReport
} from './types';
import {
  shouldStartRefine,
  useRefineReview,
  type RefineHandle
} from './useRefineReview';

export interface RefineCoordinator {
  refine: RefineHandle;
  clearRefineState: () => void;
  startRefineForReport: (report: UIVerificationReport | null) => void;
}

/**
 * Owns the row-level refine handle, tracks which report has already
 * triggered a refine call, and exposes a single `start` callback that
 * `useSingleReviewFlow` can wire into both the live-report ready hook
 * and the post-terminal effect without duplicating decision logic.
 */
export function useRefineCoordinator(input: {
  useFixtureReport: boolean;
  beverage: BeverageSelection;
  fields: IntakeFields;
  imageRef: RefObject<LabelImage | null>;
  secondaryImageRef: RefObject<LabelImage | null>;
}): RefineCoordinator {
  const {
    useFixtureReport,
    beverage,
    fields,
    imageRef,
    secondaryImageRef
  } = input;
  const refine = useRefineReview();
  const startedReportIdRef = useRef<string | null>(null);

  const clearRefineState = useCallback(() => {
    startedReportIdRef.current = null;
    refine.reset();
  }, [refine]);

  const startRefineForReport = useCallback(
    (nextReport: UIVerificationReport | null) => {
      const currentImage = imageRef.current;
      if (!nextReport || !currentImage) {
        return;
      }

      if (
        !shouldStartRefine({
          report: nextReport,
          image: currentImage,
          useFixtureReport,
          startedReportId: startedReportIdRef.current
        })
      ) {
        return;
      }

      startedReportIdRef.current = nextReport.id;
      refine.start({
        report: nextReport,
        image: currentImage,
        secondaryImage: secondaryImageRef.current,
        beverage,
        fields
      });
    },
    [beverage, fields, imageRef, refine, secondaryImageRef, useFixtureReport]
  );

  return { refine, clearRefineState, startRefineForReport };
}
