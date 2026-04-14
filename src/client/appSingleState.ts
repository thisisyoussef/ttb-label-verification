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
  { id: 'extracting-fields', label: 'Extracting structured fields' },
  { id: 'detecting-beverage', label: 'Detecting beverage type' },
  { id: 'running-checks', label: 'Running deterministic checks' },
  { id: 'preparing-evidence', label: 'Preparing evidence' }
];

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
