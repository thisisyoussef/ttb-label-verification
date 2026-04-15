export type GoldenCase = {
  id: string;
  slug: string;
  title: string;
  suiteIds: string[];
  mode: string;
  beverageType: string;
  requiresLiveAsset: boolean;
  requiresApplicationData: boolean;
  assetPath?: string;
  applicableTo?: string[];
  expectedPrimaryResult?: string;
  expectedSummary?: string | null;
  focus?: string[];
  notes?: string;
};

export type GoldenManifest = {
  version: number;
  source: string;
  slices: Record<string, { description: string; caseIds: string[] }>;
  cases: GoldenCase[];
};

export type ColaCloudCase = {
  id: string;
  goldenCaseId: string;
  title: string;
  assetPath: string;
  beverageType: 'distilled-spirits' | 'wine' | 'malt-beverage';
  expectedRecommendation?: 'approve' | 'review' | 'reject';
  colaCloudMeta: {
    ttbId?: string;
    abv: number | null;
    className: string;
    originName?: string;
    domesticOrImported?: string;
    approvalDate?: string | null;
    brandName: string;
    productName: string | null;
    wineAppellation: string | null;
    wineVintageYear: number | null;
  };
};

export type ColaCloudManifest = {
  version?: number;
  sliceId?: string;
  sourceManifest?: string;
  description?: string;
  cases: ColaCloudCase[];
};

export type SupplementalNegativeCase = {
  id: string;
  goldenCaseId: string;
  title: string;
  assetPath: string;
  beverageType: 'distilled-spirits' | 'wine' | 'malt-beverage';
  scenario?: string;
  expectedRecommendation: 'review' | 'reject';
  sourceCaseId?: string;
  mutation: {
    kind:
      | 'abv-overlay'
      | 'warning-occlusion'
      | 'warning-crop'
      | 'global-blur'
      | 'low-contrast'
      | 'label-overprint'
      | string;
    note: string;
  };
  batchCsv: {
    brandName: string;
    fancifulName: string;
    classType: string;
    alcoholContent: string;
    netContents: string;
    origin?: string;
    country?: string;
    formulaId?: string;
    appellation: string;
    vintage: string;
  };
};

export type SupplementalNegativeManifest = {
  version: number;
  sourceManifest: string;
  sliceId: string;
  description: string;
  cases: SupplementalNegativeCase[];
};

export function formatAlcoholContent(abv: number | null) {
  if (abv === null) {
    return '';
  }

  return `${Number.isInteger(abv) ? String(abv) : String(abv)}% Alc./Vol.`;
}

export function defaultNetContents(beverageType: string) {
  return beverageType === 'malt-beverage' ? '12 FL OZ' : '750 mL';
}
