import { buildNoTextReport, buildReportForScenario, buildStandaloneReport } from './resultScenarios';
import type { IntakeFields, ResultVariantOverride, UIVerificationReport } from './types';

export function fixturesEnabled(input: {
  isDev: boolean;
  override: string | boolean | undefined;
}): boolean {
  if (typeof input.override === 'boolean') {
    return input.override;
  }

  if (typeof input.override === 'string') {
    const normalized = input.override.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return input.isDev;
}

export function resolveResultReport(input: {
  fields: IntakeFields;
  liveReport: UIVerificationReport | null;
  scenarioId: string;
  useFixtureReport: boolean;
  variantOverride: ResultVariantOverride;
}): UIVerificationReport {
  if (input.variantOverride === 'no-text-extracted') {
    return buildNoTextReport();
  }

  if (input.variantOverride === 'standalone') {
    return buildStandaloneReport();
  }

  if (input.useFixtureReport) {
    return buildReportForScenario(input.scenarioId);
  }

  if (input.liveReport) {
    return input.liveReport;
  }

  if (fieldsAreEmpty(input.fields)) {
    return buildStandaloneReport();
  }

  return buildReportForScenario(input.scenarioId);
}

function fieldsAreEmpty(fields: IntakeFields): boolean {
  const { varietals, origin: _origin, ...rest } = fields;
  const textEmpty = Object.values(rest).every((value) => value === '');
  return textEmpty && varietals.length === 0;
}
