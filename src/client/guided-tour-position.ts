export interface GuidedTourRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface GuidedTourViewport {
  calloutHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

const CALLOUT_GAP = 16;
const CALLOUT_MARGIN = 16;
const CALLOUT_MAX_WIDTH = 420;

export function resolveCalloutPosition(
  rect: GuidedTourRect | null,
  viewport: GuidedTourViewport
) {
  const width = Math.min(CALLOUT_MAX_WIDTH, viewport.viewportWidth * 0.92);
  const safeHeight = Math.min(
    Math.max(viewport.calloutHeight, 0),
    Math.max(0, viewport.viewportHeight - CALLOUT_MARGIN * 2)
  );

  if (!rect) {
    return {
      top: clamp(
        (viewport.viewportHeight - safeHeight) / 2,
        CALLOUT_MARGIN,
        viewport.viewportHeight - safeHeight - CALLOUT_MARGIN
      ),
      left: clamp(
        viewport.viewportWidth / 2 - width / 2,
        CALLOUT_MARGIN,
        viewport.viewportWidth - width - CALLOUT_MARGIN
      ),
      width
    };
  }

  const spaceBelow = viewport.viewportHeight - (rect.top + rect.height) - CALLOUT_GAP;
  const spaceAbove = rect.top - CALLOUT_GAP;
  const spaceRight = viewport.viewportWidth - (rect.left + rect.width) - CALLOUT_GAP;
  const spaceLeft = rect.left - CALLOUT_GAP;

  let top: number;
  let left: number;

  if (spaceBelow >= safeHeight) {
    top = rect.top + rect.height + CALLOUT_GAP;
    left = rect.left + rect.width / 2 - width / 2;
  } else if (spaceAbove >= safeHeight) {
    top = rect.top - safeHeight - CALLOUT_GAP;
    left = rect.left + rect.width / 2 - width / 2;
  } else if (spaceRight >= width) {
    top = rect.top + rect.height / 2 - safeHeight / 2;
    left = rect.left + rect.width + CALLOUT_GAP;
  } else if (spaceLeft >= width) {
    top = rect.top + rect.height / 2 - safeHeight / 2;
    left = rect.left - width - CALLOUT_GAP;
  } else {
    top = viewport.viewportHeight - safeHeight - 24;
    left = viewport.viewportWidth / 2 - width / 2;
  }

  return {
    top: clamp(
      top,
      CALLOUT_MARGIN,
      viewport.viewportHeight - safeHeight - CALLOUT_MARGIN
    ),
    left: clamp(
      left,
      CALLOUT_MARGIN,
      viewport.viewportWidth - width - CALLOUT_MARGIN
    ),
    width
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
