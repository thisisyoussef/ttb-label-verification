export const TOUR_TARGET_KEYS = [
  'tour-launcher',
  'tour-mode-toggle',
  'tour-drop-zone',
  'tour-verify-button',
  'tour-verdict-banner',
  'tour-warning-row',
  'tour-batch-tab',
  'tour-batch-intake',
  'tour-privacy-anchor'
] as const;

export type TourTargetKey = (typeof TOUR_TARGET_KEYS)[number];

export function findTourTarget(key: TourTargetKey): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(`[data-tour-target="${key}"]`);
}
