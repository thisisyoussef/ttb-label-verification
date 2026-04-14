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
  scrollX: number;
  scrollY: number;
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
        viewport.scrollY + (viewport.viewportHeight - safeHeight) / 2,
        viewport.scrollY + CALLOUT_MARGIN,
        viewport.scrollY + viewport.viewportHeight - safeHeight - CALLOUT_MARGIN
      ),
      left: clamp(
        viewport.scrollX + viewport.viewportWidth / 2 - width / 2,
        viewport.scrollX + CALLOUT_MARGIN,
        viewport.scrollX + viewport.viewportWidth - width - CALLOUT_MARGIN
      ),
      width
    };
  }

  const targetViewportTop = rect.top - viewport.scrollY;
  const targetViewportBottom = rect.top + rect.height - viewport.scrollY;
  const targetViewportLeft = rect.left - viewport.scrollX;
  const targetViewportRight = rect.left + rect.width - viewport.scrollX;

  const spaceBelow = viewport.viewportHeight - targetViewportBottom - CALLOUT_GAP;
  const spaceAbove = targetViewportTop - CALLOUT_GAP;
  const spaceRight = viewport.viewportWidth - targetViewportRight - CALLOUT_GAP;
  const spaceLeft = targetViewportLeft - CALLOUT_GAP;

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
    top = viewport.scrollY + viewport.viewportHeight - safeHeight - 24;
    left = viewport.scrollX + viewport.viewportWidth / 2 - width / 2;
  }

  return {
    top: clamp(
      top,
      viewport.scrollY + CALLOUT_MARGIN,
      viewport.scrollY + viewport.viewportHeight - safeHeight - CALLOUT_MARGIN
    ),
    left: clamp(
      left,
      viewport.scrollX + CALLOUT_MARGIN,
      viewport.scrollX + viewport.viewportWidth - width - CALLOUT_MARGIN
    ),
    width
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
