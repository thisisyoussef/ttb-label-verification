export interface ToolbenchImageAsset {
  id: string;
  name: string;
  description: string;
  filename: string;
  url: string;
}

export interface ToolbenchCsvAsset {
  id: string;
  name: string;
  description: string;
  filename: string;
  url: string;
}

export const LABEL_IMAGE_ASSETS: ToolbenchImageAsset[] = [
  {
    id: 'beer-forbidden-abv-format',
    name: 'Beer — Forbidden ABV Format',
    description: 'Tests detection of prohibited ABV expression format on a beer label',
    filename: 'beer-forbidden-abv-format.png',
    url: '/toolbench/labels/beer-forbidden-abv-format.png',
  },
  {
    id: 'beer-net-contents-metric-primary',
    name: 'Beer — Metric Net Contents',
    description: 'Tests net-contents rule when metric units appear as the primary declaration',
    filename: 'beer-net-contents-metric-primary.png',
    url: '/toolbench/labels/beer-net-contents-metric-primary.png',
  },
  {
    id: 'beer-unqualified-geographic-style',
    name: 'Beer — Unqualified Geographic Style',
    description: 'Tests use of a semi-generic geographic name without required qualification',
    filename: 'beer-unqualified-geographic-style.png',
    url: '/toolbench/labels/beer-unqualified-geographic-style.png',
  },
  {
    id: 'imported-without-country-of-origin',
    name: 'Imported — Missing Country of Origin',
    description: 'Tests that an imported product lacks the mandatory country-of-origin statement',
    filename: 'imported-without-country-of-origin.png',
    url: '/toolbench/labels/imported-without-country-of-origin.png',
  },
  {
    id: 'low-quality-image',
    name: 'Low-Quality Image',
    description: 'Tests system behavior when label scan confidence is below acceptance threshold',
    filename: 'low-quality-image.png',
    url: '/toolbench/labels/low-quality-image.png',
  },
  {
    id: 'perfect-beer-label',
    name: 'Perfect Beer Label',
    description: 'Clean beer label that should pass all TTB checks with no findings',
    filename: 'perfect-beer-label.png',
    url: '/toolbench/labels/perfect-beer-label.png',
  },
  {
    id: 'perfect-spirit-label',
    name: 'Perfect Spirit Label',
    description: 'Clean spirit label that should pass all TTB checks with no findings',
    filename: 'perfect-spirit-label.png',
    url: '/toolbench/labels/perfect-spirit-label.png',
  },
  {
    id: 'spirit-brand-case-mismatch',
    name: 'Spirit — Brand Case Mismatch',
    description: 'Tests detection of brand name casing inconsistency across label panels',
    filename: 'spirit-brand-case-mismatch.png',
    url: '/toolbench/labels/spirit-brand-case-mismatch.png',
  },
  {
    id: 'spirit-warning-errors',
    name: 'Spirit — Warning Text Errors',
    description: 'Tests detection of defects in the mandatory government warning statement',
    filename: 'spirit-warning-errors.png',
    url: '/toolbench/labels/spirit-warning-errors.png',
  },
  {
    id: 'spirits-abv-abbreviation',
    name: 'Spirits — ABV Abbreviation',
    description: 'Tests whether "ABV" abbreviation is accepted in place of "Alc/Vol"',
    filename: 'spirits-abv-abbreviation.png',
    url: '/toolbench/labels/spirits-abv-abbreviation.png',
  },
  {
    id: 'spirits-net-contents-us-measures',
    name: 'Spirits — US Net Contents',
    description: 'Tests net-contents rule when US customary units are used on a spirit label',
    filename: 'spirits-net-contents-us-measures.png',
    url: '/toolbench/labels/spirits-net-contents-us-measures.png',
  },
  {
    id: 'spirits-proof-not-parenthesized',
    name: 'Spirits — Proof Not Parenthesized',
    description: 'Tests that proof statement appears without required parenthetical formatting',
    filename: 'spirits-proof-not-parenthesized.png',
    url: '/toolbench/labels/spirits-proof-not-parenthesized.png',
  },
  {
    id: 'warning-completely-missing',
    name: 'Warning — Completely Missing',
    description: 'Tests detection when the government warning statement is absent entirely',
    filename: 'warning-completely-missing.png',
    url: '/toolbench/labels/warning-completely-missing.png',
  },
  {
    id: 'whisky-age-ambiguity',
    name: 'Whisky — Age Ambiguity',
    description: 'Tests handling of ambiguous age statement that may trigger a compliance finding',
    filename: 'whisky-age-ambiguity.png',
    url: '/toolbench/labels/whisky-age-ambiguity.png',
  },
  {
    id: 'wine-missing-appellation',
    name: 'Wine — Missing Appellation',
    description: 'Tests detection of a varietal claim made without a required appellation of origin',
    filename: 'wine-missing-appellation.png',
    url: '/toolbench/labels/wine-missing-appellation.png',
  },
  {
    id: 'wine-multiple-varietals-invalid-total',
    name: 'Wine — Multiple Varietals (Invalid Total)',
    description: 'Tests that varietal percentages do not sum to 100% as required',
    filename: 'wine-multiple-varietals-invalid-total.png',
    url: '/toolbench/labels/wine-multiple-varietals-invalid-total.png',
  },
  {
    id: 'wine-multiple-varietals-valid',
    name: 'Wine — Multiple Varietals (Valid)',
    description: 'Clean multi-varietal wine label with correct percentage totals',
    filename: 'wine-multiple-varietals-valid.png',
    url: '/toolbench/labels/wine-multiple-varietals-valid.png',
  },
  {
    id: 'wine-table-wine-exemption',
    name: 'Wine — Table Wine Exemption',
    description: 'Tests application of table wine ABV exemption rules',
    filename: 'wine-table-wine-exemption.png',
    url: '/toolbench/labels/wine-table-wine-exemption.png',
  },
  {
    id: 'wine-varietal-without-appellation',
    name: 'Wine — Varietal Without Appellation',
    description: 'Tests varietal designation present but appellation of origin statement missing',
    filename: 'wine-varietal-without-appellation.png',
    url: '/toolbench/labels/wine-varietal-without-appellation.png',
  },
  {
    id: 'wine-vintage-with-appellation',
    name: 'Wine — Vintage With Appellation',
    description: 'Tests vintage year claim paired with a valid appellation of origin',
    filename: 'wine-vintage-with-appellation.png',
    url: '/toolbench/labels/wine-vintage-with-appellation.png',
  },
];

export const CSV_ASSETS: ToolbenchCsvAsset[] = [
  {
    id: 'clean-six',
    name: 'Clean Six',
    description: 'Valid CSV with 6 matching rows',
    filename: 'clean-six.csv',
    url: '/toolbench/csv/clean-six.csv',
  },
  {
    id: 'malformed',
    name: 'Malformed CSV',
    description: 'CSV that triggers a parse error',
    filename: 'malformed.csv',
    url: '/toolbench/csv/malformed.csv',
  },
];
