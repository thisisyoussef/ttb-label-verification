import { TOUR_TARGET_KEYS, type TourTargetKey } from '../../shared/contracts/help';

export { TOUR_TARGET_KEYS };
export type { TourTargetKey };

export function findTourTarget(key: TourTargetKey): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector<HTMLElement>(`[data-tour-target="${key}"]`);
}
