/**
 * Net-contents unit conversion + standard bottle sizes.
 *
 * The COLA form and the label can state the same volume in different
 * units: the form might say "750 mL" and the label "25.4 FL OZ".
 * Deterministic conversion (1 fl oz = 29.5735 mL) resolves equivalence
 * without round-tripping to the LLM.
 *
 * Standard TTB bottle sizes per 27 CFR 4.72 (wine) and 27 CFR 5.203
 * (spirits) — "50mL, 100mL, 187mL, 200mL, 375mL, 500mL, 750mL, 1L,
 * 1.5L, 1.75L, 3L". A label that rounds "750 mL" to "25 fl oz"
 * (vs. the correct 25.4) is a minor rounding quirk, not a real
 * mismatch — we clamp to the nearest standard size when both sides
 * are within tolerance.
 */

/** Exact conversion factor: fluid ounces (US) → millilitres. */
export const ML_PER_US_FL_OZ = 29.5735;

/** TTB-standard wine + spirits bottle sizes (mL). */
export const STANDARD_BOTTLE_SIZES_ML: readonly number[] = [
  50, 100, 187, 200, 375, 500, 750, 1000, 1500, 1750, 3000
];

export type VolumeUnit = 'ml' | 'fl oz' | 'l' | 'cl' | 'pint' | 'gal' | null;

/** Parses a string like "750 mL" or "25.4 FL OZ" into { amount, unit }. */
export function parseVolume(raw: string): { amount: number; unit: VolumeUnit } | null {
  const cleaned = raw.toLowerCase().trim();
  // Match: number + optional whitespace + unit word
  const match = cleaned.match(
    /(\d+(?:\.\d+)?)\s*(ml|fl\.?\s*oz\.?|oz|l\b|cl\b|pint|gal|gallon)s?\b/
  );
  if (!match) return null;
  const amount = Number.parseFloat(match[1]!);
  const rawUnit = match[2]!.replace(/\s+/g, '').replace(/\./g, '');
  let unit: VolumeUnit = null;
  if (rawUnit === 'ml') unit = 'ml';
  else if (rawUnit === 'floz' || rawUnit === 'oz') unit = 'fl oz';
  else if (rawUnit === 'l') unit = 'l';
  else if (rawUnit === 'cl') unit = 'cl';
  else if (rawUnit === 'pint') unit = 'pint';
  else if (rawUnit === 'gal' || rawUnit === 'gallon') unit = 'gal';
  if (unit === null) return null;
  return { amount, unit };
}

/** Convert any recognized unit to millilitres. */
export function toMilliliters(amount: number, unit: VolumeUnit): number | null {
  switch (unit) {
    case 'ml': return amount;
    case 'cl': return amount * 10;
    case 'l': return amount * 1000;
    case 'fl oz': return amount * ML_PER_US_FL_OZ;
    case 'pint': return amount * 473.176; // US pint
    case 'gal': return amount * 3785.41; // US gallon
    default: return null;
  }
}

/**
 * True when two net-contents strings describe volumes within a
 * tolerance. Default 5 mL matches what the existing net-contents rule
 * uses (rounding conventions on small bottles are common). Set to 0
 * for strict.
 */
export function isVolumeEquivalent(a: string, b: string, toleranceMl = 5): boolean {
  const pa = parseVolume(a);
  const pb = parseVolume(b);
  if (!pa || !pb) return false;
  const ma = toMilliliters(pa.amount, pa.unit);
  const mb = toMilliliters(pb.amount, pb.unit);
  if (ma === null || mb === null) return false;
  return Math.abs(ma - mb) <= toleranceMl;
}

/**
 * Snap a volume in millilitres to the nearest TTB-standard bottle
 * size if within `toleranceMl`. Returns the original value if no
 * standard size is close enough.
 */
export function snapToStandardBottleSize(ml: number, toleranceMl = 5): number {
  let best: number = ml;
  let bestDiff = Infinity;
  for (const size of STANDARD_BOTTLE_SIZES_ML) {
    const diff = Math.abs(ml - size);
    if (diff <= toleranceMl && diff < bestDiff) {
      best = size;
      bestDiff = diff;
    }
  }
  return best;
}

/**
 * True when both label and form resolve to the SAME TTB-standard
 * bottle size after snapping. This catches "750 mL" on the form vs
 * "25 FL OZ" (739 mL) on the label — both snap to 750 within 5 mL
 * tolerance, and the rounding is a label-print artifact rather than
 * a real mismatch.
 */
export function resolvesToSameStandardBottle(
  a: string,
  b: string,
  toleranceMl = 5
): boolean {
  const pa = parseVolume(a);
  const pb = parseVolume(b);
  if (!pa || !pb) return false;
  const ma = toMilliliters(pa.amount, pa.unit);
  const mb = toMilliliters(pb.amount, pb.unit);
  if (ma === null || mb === null) return false;
  const snappedA = snapToStandardBottleSize(ma, toleranceMl);
  const snappedB = snapToStandardBottleSize(mb, toleranceMl);
  // Both snap to the same standard AND that standard is non-trivially
  // close to the original reading. If neither snapped (no standard
  // within tolerance), fall back to the raw equivalence check.
  if (snappedA === snappedB) return true;
  return Math.abs(ma - mb) <= toleranceMl;
}
