import { buildLabelThumbnail } from '../labelThumbnail';
import { buildReportForScenario } from '../resultScenarios';
import type {
  BatchDashboardIssues,
  BatchDashboardRow,
  BatchDashboardSeed,
  BatchDashboardSummary,
  BatchItemStatus
} from './batchTypes';
import type { CheckReview } from '../types';

interface RowSeed {
  rowId: string;
  reportId: string;
  imageId: string;
  filename: string;
  brandName: string;
  classType: string;
  scenarioId: string;
  completedOrder: number;
  isPdf?: boolean;
  sizeLabel: string;
}

interface ErrorRowSeed {
  rowId: string;
  imageId: string;
  filename: string;
  brandName: string;
  classType: string;
  completedOrder: number;
  errorMessage: string;
  sizeLabel: string;
  isPdf?: boolean;
  previewSeed?: { brandName: string; classType: string };
}

function verdictToStatus(verdict: 'approve' | 'review' | 'reject'): BatchItemStatus {
  switch (verdict) {
    case 'approve':
      return 'pass';
    case 'review':
      return 'review';
    case 'reject':
      return 'fail';
  }
}

function issuesFromReport(checks: CheckReview[]): BatchDashboardIssues {
  const totals: BatchDashboardIssues = { blocker: 0, major: 0, minor: 0, note: 0 };
  for (const check of checks) {
    if (check.status === 'pass' || check.status === 'info') continue;
    if (check.severity === 'blocker') totals.blocker += 1;
    else if (check.severity === 'major') totals.major += 1;
    else if (check.severity === 'minor') totals.minor += 1;
    else if (check.severity === 'note') totals.note += 1;
  }
  return totals;
}

function buildRow(seed: RowSeed): BatchDashboardRow {
  const report = buildReportForScenario(seed.scenarioId);
  const issues = issuesFromReport([...report.checks, ...report.crossFieldChecks]);
  const isPdf = seed.isPdf ?? seed.filename.toLowerCase().endsWith('.pdf');
  return {
    rowId: seed.rowId,
    reportId: seed.reportId,
    imageId: seed.imageId,
    filename: seed.filename,
    brandName: seed.brandName,
    classType: seed.classType,
    beverageType: report.beverageType,
    status: verdictToStatus(report.verdict),
    previewUrl: isPdf
      ? null
      : buildLabelThumbnail({
          brandName: seed.brandName,
          classType: seed.classType
        }),
    isPdf,
    sizeLabel: seed.sizeLabel,
    issues,
    confidenceState: report.extractionQuality.state,
    errorMessage: null,
    completedOrder: seed.completedOrder,
    scenarioId: seed.scenarioId
  };
}

function buildErrorRow(seed: ErrorRowSeed): BatchDashboardRow {
  const isPdf = seed.isPdf ?? seed.filename.toLowerCase().endsWith('.pdf');
  return {
    rowId: seed.rowId,
    reportId: null,
    imageId: seed.imageId,
    filename: seed.filename,
    brandName: seed.brandName,
    classType: seed.classType,
    beverageType: 'unknown',
    status: 'error',
    previewUrl:
      isPdf || !seed.previewSeed
        ? null
        : buildLabelThumbnail(seed.previewSeed),
    isPdf,
    sizeLabel: seed.sizeLabel,
    issues: { blocker: 0, major: 0, minor: 0, note: 0 },
    confidenceState: 'no-text-extracted',
    errorMessage: seed.errorMessage,
    completedOrder: seed.completedOrder,
    scenarioId: 'no-text-extracted'
  };
}

function summarize(rows: BatchDashboardRow[]): BatchDashboardSummary {
  const tally: BatchDashboardSummary = { pass: 0, review: 0, fail: 0, error: 0 };
  for (const row of rows) {
    switch (row.status) {
      case 'pass':
        tally.pass += 1;
        break;
      case 'review':
        tally.review += 1;
        break;
      case 'fail':
        tally.fail += 1;
        break;
      case 'error':
        tally.error += 1;
        break;
    }
  }
  return tally;
}

const SIX_SEEDS: RowSeed[] = [
  {
    rowId: 'db-1',
    reportId: 'report-1',
    imageId: 'img-1',
    filename: 'old-oak-bourbon.jpg',
    brandName: 'Old Oak Bourbon',
    classType: 'Kentucky Straight Bourbon',
    scenarioId: 'perfect-spirit-label',
    completedOrder: 1,
    sizeLabel: '2.8 MB'
  },
  {
    rowId: 'db-2',
    reportId: 'report-2',
    imageId: 'img-2',
    filename: "stones-throw-gin.jpg",
    brandName: "Stone's Throw Gin",
    classType: 'Small Batch Gin',
    scenarioId: 'spirit-warning-errors',
    completedOrder: 2,
    sizeLabel: '3.1 MB'
  },
  {
    rowId: 'db-3',
    reportId: 'report-3',
    imageId: 'img-3',
    filename: 'brand-case-mismatch.png',
    brandName: 'Stone Throw Gin',
    classType: 'Small Batch Gin',
    scenarioId: 'spirit-brand-case-mismatch',
    completedOrder: 3,
    sizeLabel: '1.9 MB'
  },
  {
    rowId: 'db-4',
    reportId: 'report-4',
    imageId: 'img-4',
    filename: 'vintners-red-2021.jpg',
    brandName: 'Vintner Red 2021',
    classType: 'Napa Valley Cabernet',
    scenarioId: 'wine-missing-appellation',
    completedOrder: 4,
    sizeLabel: '4.2 MB'
  },
  {
    rowId: 'db-5',
    reportId: 'report-5',
    imageId: 'img-5',
    filename: 'hop-barrel-lager.webp',
    brandName: 'Hop Barrel Lager',
    classType: 'American Lager',
    scenarioId: 'beer-forbidden-abv-format',
    completedOrder: 5,
    sizeLabel: '1.4 MB'
  },
  {
    rowId: 'db-6',
    reportId: 'report-6',
    imageId: 'img-6',
    filename: 'low-quality-scan.pdf',
    brandName: 'Heritage Whiskey',
    classType: 'Tennessee Whiskey',
    scenarioId: 'low-quality-image',
    completedOrder: 6,
    sizeLabel: '5.6 MB',
    isPdf: true
  }
];

function seedTerminalMixed(): BatchDashboardSeed {
  const rows = SIX_SEEDS.map(buildRow);
  return {
    id: 'dash-terminal-mixed',
    label: 'Terminal — mixed outcomes',
    description:
      'Six-label batch with a realistic spread of approve, review, and reject outcomes.',
    phase: 'complete',
    totals: { started: 6, done: 6 },
    summary: summarize(rows),
    rows
  };
}

function seedTerminalAllPass(): BatchDashboardSeed {
  const passScenarios = ['perfect-spirit-label'];
  const brands: Array<{ brandName: string; classType: string; filename: string }> = [
    { brandName: 'Old Oak Bourbon', classType: 'Kentucky Straight Bourbon', filename: 'old-oak-bourbon.jpg' },
    { brandName: 'Cellar Reserve Riesling', classType: '2022 Napa Valley', filename: 'cellar-reserve-riesling.jpg' },
    { brandName: 'Harbor Brewing', classType: 'American Lager', filename: 'harbor-lager.webp' },
    { brandName: 'Highland Scotch', classType: '12 Year Single Malt', filename: 'highland-scotch.jpg' },
    { brandName: 'Midnight Rum', classType: 'Aged 5 Years', filename: 'midnight-rum.jpg' },
    { brandName: 'Clear Creek Vodka', classType: 'Silver', filename: 'clear-creek-vodka.jpg' }
  ];
  const rows: BatchDashboardRow[] = brands.map((brand, index) =>
    buildRow({
      rowId: `all-pass-${index + 1}`,
      reportId: `all-pass-report-${index + 1}`,
      imageId: `all-pass-img-${index + 1}`,
      filename: brand.filename,
      brandName: brand.brandName,
      classType: brand.classType,
      scenarioId: passScenarios[0]!,
      completedOrder: index + 1,
      sizeLabel: '2.5 MB'
    })
  );
  return {
    id: 'dash-terminal-all-pass',
    label: 'Terminal — all pass',
    description: 'Every label in this batch approved.',
    phase: 'complete',
    totals: { started: rows.length, done: rows.length },
    summary: summarize(rows),
    rows
  };
}

function seedTerminalAllFail(): BatchDashboardSeed {
  const failScenarios = [
    'spirit-warning-errors',
    'wine-missing-appellation',
    'beer-forbidden-abv-format'
  ];
  const brands: Array<{ brandName: string; classType: string; filename: string; scenarioId: string }> = [
    { brandName: 'Ironwood Vodka', classType: 'Vodka', filename: 'ironwood-vodka.jpg', scenarioId: failScenarios[0]! },
    { brandName: 'Heritage Hill Red', classType: 'Red Wine 2021', filename: 'heritage-hill-red.jpg', scenarioId: failScenarios[1]! },
    { brandName: 'Harbor Lager', classType: 'Lager', filename: 'harbor-lager.webp', scenarioId: failScenarios[2]! },
    { brandName: 'Darkwood Rye', classType: 'Straight Rye', filename: 'darkwood-rye.jpg', scenarioId: failScenarios[0]! },
    { brandName: 'Coastal Merlot', classType: 'Red Wine 2022', filename: 'coastal-merlot.jpg', scenarioId: failScenarios[1]! },
    { brandName: 'Pacific IPA', classType: 'India Pale Ale', filename: 'pacific-ipa.webp', scenarioId: failScenarios[2]! }
  ];
  const rows: BatchDashboardRow[] = brands.map((brand, index) =>
    buildRow({
      rowId: `all-fail-${index + 1}`,
      reportId: `all-fail-report-${index + 1}`,
      imageId: `all-fail-img-${index + 1}`,
      filename: brand.filename,
      brandName: brand.brandName,
      classType: brand.classType,
      scenarioId: brand.scenarioId,
      completedOrder: index + 1,
      sizeLabel: '3.0 MB'
    })
  );
  return {
    id: 'dash-terminal-all-fail',
    label: 'Terminal — all fail',
    description: 'Every label in this batch rejected.',
    phase: 'complete',
    totals: { started: rows.length, done: rows.length },
    summary: summarize(rows),
    rows
  };
}

function seedCancelledPartial(): BatchDashboardSeed {
  const partialSeeds: RowSeed[] = SIX_SEEDS.slice(0, 3);
  const rows = partialSeeds.map(buildRow);
  return {
    id: 'dash-cancelled-partial',
    label: 'Cancelled partial',
    description: 'Three of twelve labels completed before the reviewer cancelled the batch.',
    phase: 'cancelled-partial',
    totals: { started: 12, done: 3 },
    summary: summarize(rows),
    rows
  };
}

function seedWithErrorRow(): BatchDashboardSeed {
  const rows: BatchDashboardRow[] = [
    ...SIX_SEEDS.slice(0, 5).map(buildRow),
    buildErrorRow({
      rowId: 'err-row-1',
      imageId: 'err-img-1',
      filename: 'casa-vieja.jpg',
      brandName: 'Casa Vieja',
      classType: 'Añejo Tequila',
      completedOrder: 6,
      errorMessage: 'The connection dropped before this item finished.',
      sizeLabel: '2.0 MB',
      previewSeed: { brandName: 'Casa Vieja', classType: 'Añejo Tequila' }
    })
  ];
  return {
    id: 'dash-with-error',
    label: 'Mixed with one error row',
    description:
      'Six-label batch where one item failed to complete and can be retried inline.',
    phase: 'complete',
    totals: { started: 6, done: 5 },
    summary: summarize(rows),
    rows
  };
}

export const DASHBOARD_SEEDS: BatchDashboardSeed[] = [
  seedTerminalMixed(),
  seedWithErrorRow(),
  seedTerminalAllPass(),
  seedTerminalAllFail(),
  seedCancelledPartial()
];

export const DEFAULT_DASHBOARD_SEED_ID = 'dash-terminal-mixed';

export function findDashboardSeed(id: string): BatchDashboardSeed {
  const found = DASHBOARD_SEEDS.find((seed) => seed.id === id);
  if (!found) {
    throw new Error(`Unknown dashboard seed: ${id}`);
  }
  return found;
}
