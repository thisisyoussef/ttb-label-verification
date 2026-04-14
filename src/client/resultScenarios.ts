import {
  lowQualityImageReport,
  perfectSpiritReport,
  spiritBrandCaseMismatchReport,
  spiritWarningErrorsReport
} from './resultScenarioPrimaryReports';
import {
  beerForbiddenAbvFormatReport,
  noTextExtractedReport,
  standaloneDemoReport,
  wineMissingAppellationReport
} from './resultScenarioSecondaryReports';
import type { UIVerificationReport } from './types';

const REPORT_FACTORIES: Record<string, () => UIVerificationReport> = {
  blank: perfectSpiritReport,
  'perfect-spirit-label': perfectSpiritReport,
  'spirit-warning-errors': spiritWarningErrorsReport,
  'spirit-brand-case-mismatch': spiritBrandCaseMismatchReport,
  'wine-missing-appellation': wineMissingAppellationReport,
  'beer-forbidden-abv-format': beerForbiddenAbvFormatReport,
  'low-quality-image': lowQualityImageReport
};

export function buildReportForScenario(scenarioId: string): UIVerificationReport {
  const factory = REPORT_FACTORIES[scenarioId] ?? perfectSpiritReport;
  return factory();
}

export function buildStandaloneReport(): UIVerificationReport {
  return standaloneDemoReport();
}

export function buildNoTextReport(): UIVerificationReport {
  return noTextExtractedReport();
}
