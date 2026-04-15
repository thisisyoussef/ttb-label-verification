import { buildReportForScenario } from './resultScenarios';
import { seedScenarios } from './scenarios';
import type {
  IntakeFields,
  ProcessingStep,
  ProcessingStepId,
  UIVerificationReport
} from './types';

const STEP_TEMPLATE: { id: ProcessingStepId; label: string }[] = [
  { id: 'reading-image', label: 'Reading label image' },
  { id: 'extracting-fields', label: 'Identifying label fields' },
  { id: 'detecting-beverage', label: 'Detecting beverage type' },
  { id: 'running-checks', label: 'Running compliance checks' },
  { id: 'preparing-evidence', label: 'Preparing evidence' }
];

/**
 * Per-step delay schedule (ms). Each entry is the delay *before* the
 * corresponding step index completes and the next one activates.
 *
 * Index 0 → "Reading label image" completes after 400 ms (first visible advancement).
 * Index 1 → "Extracting structured fields" completes after 800 ms.
 * Index 2 → "Detecting beverage type" completes after 1 100 ms.
 * Index 3 → "Running compliance checks" completes after 1 200 ms.
 * Index 4 → final step idles; waits for the API response.
 *
 * Cumulative: 0 → 400 → 1 200 → 2 300 → 3 500 ms.
 * The last step ("Preparing evidence") appears at ~3.5 s and stays
 * active until the real response lands, targeting a total of ~4.5 s.
 */
export const STEP_DELAYS_MS: number[] = [400, 800, 1100, 1200, 1000];

/** @deprecated Use STEP_DELAYS_MS for per-step scheduling. */
export const STEP_ADVANCE_MS = 900;

const EXTRACTED_TO_FIELD: Array<{ checkId: string; field: keyof IntakeFields }> = [
  { checkId: 'brand-name', field: 'brandName' },
  { checkId: 'fanciful-name', field: 'fancifulName' },
  { checkId: 'class-type', field: 'classType' },
  { checkId: 'alcohol-content', field: 'alcoholContent' },
  { checkId: 'net-contents', field: 'netContents' },
  { checkId: 'applicant-address', field: 'applicantAddress' }
];

export function buildInitialSteps(): ProcessingStep[] {
  return STEP_TEMPLATE.map((template, index) => ({
    ...template,
    status: index === 0 ? 'active' : 'pending'
  }));
}

export function emptyIntake(): IntakeFields {
  const blank = seedScenarios[0];
  if (!blank) throw new Error('seedScenarios must include a blank scenario');
  return { ...blank.fields, varietals: [] };
}

export function prefillFromReport(
  base: IntakeFields,
  report: UIVerificationReport
): IntakeFields {
  const next = { ...base, varietals: base.varietals.map((row) => ({ ...row })) };
  for (const { checkId, field } of EXTRACTED_TO_FIELD) {
    const check = report.checks.find((candidate) => candidate.id === checkId);
    const value = check?.extractedValue;
    if (value && value.length > 0) {
      (next[field] as string) = value;
    }
  }
  return next;
}

export function buildLowQualityCautionReport() {
  return buildReportForScenario('low-quality-image');
}
