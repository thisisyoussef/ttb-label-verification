import type { BeverageSelection, IntakeFields, VarietalRow } from './types';

export interface SeedScenario {
  id: string;
  title: string;
  description: string;
  beverageType: BeverageSelection;
  fields: IntakeFields;
  /**
   * Optional reference to a real image in `evals/labels/assets/{source}/{filename}`.
   * When set, selecting the scenario in the Toolbench also fetches and loads
   * the matching label image via `/api/eval/label-image/{source}/{filename}`.
   * Leave unset for scenarios that are purely about form-data behavior with
   * no image attached.
   */
  imageAsset?: {
    source: 'cola-cloud' | 'supplemental-generated';
    filename: string;
  };
}

function emptyFields(): IntakeFields {
  return {
    brandName: '',
    fancifulName: '',
    classType: '',
    alcoholContent: '',
    netContents: '',
    applicantAddress: '',
    origin: 'domestic',
    country: '',
    formulaId: '',
    appellation: '',
    vintage: '',
    varietals: []
  };
}

function varietal(name: string, percentage: string): VarietalRow {
  return { id: `${name}-${percentage}`, name, percentage };
}

// All scenario field data is mirrored from the real COLA Cloud golden-eval
// CSV at `evals/batch/cola-cloud/cola-cloud-all.csv` so the Toolbench
// demos the same shape of data the batch eval uses. Each entry includes
// the matching label image so clicking a scenario fills the form AND the
// image slot — previously scenarios only set fields, which made the
// intake look half-prepared.
export const seedScenarios: SeedScenario[] = [
  {
    id: 'blank',
    title: 'Blank intake',
    description: 'Empty form, no image, no fields.',
    beverageType: 'auto',
    fields: emptyFields()
  },
  // Retained for tour + result-scenarios wiring (help-tour-runtime,
  // result scenarios, toolbench manifest all reference this id).
  {
    id: 'perfect-spirit-label',
    title: 'Perfect spirit label (demo)',
    description:
      'Synthetic happy-path spirits submission used by the guided tour. Use the real-COLA scenarios below for eval-quality behavior.',
    beverageType: 'distilled-spirits',
    fields: {
      ...emptyFields(),
      brandName: "Stone's Throw",
      fancifulName: 'Small Batch Reserve',
      classType: 'Kentucky Straight Bourbon Whiskey',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL',
      applicantAddress: 'Stone Throw Distilling Co., Louisville, KY',
      origin: 'domestic',
      country: ''
    }
  },
  // ─── APPROVED COLA labels (real data, clean approvals on the golden set) ───
  {
    id: 'simply-elegant-bourbon',
    title: 'Simply Elegant (bourbon, approved)',
    description:
      'Real TTB-approved Kentucky straight bourbon. Clean baseline — all fields should pass deterministic checks; the remaining review flags come from back-label fields (warning, address) that aren’t in the front photo.',
    beverageType: 'distilled-spirits',
    fields: {
      ...emptyFields(),
      brandName: 'Simply Elegant',
      fancifulName: 'Simply Elegant Spirits',
      classType: 'straight bourbon whisky',
      alcoholContent: '67% Alc./Vol.',
      origin: 'domestic'
    },
    imageAsset: {
      source: 'cola-cloud',
      filename: 'simply-elegant-simply-elegant-spirits-distilled-spirits.webp'
    }
  },
  {
    id: 'persian-empire-arak',
    title: 'Persian Empire (imported, parent/product brand)',
    description:
      'Imported Canadian spirits. Exercises the LLM-judgment path for country-of-origin ("canada" vs whatever the VLM reads) and surfaces the parent-brand-vs-product-name ambiguity common on imports.',
    beverageType: 'distilled-spirits',
    fields: {
      ...emptyFields(),
      brandName: 'Persian Empire',
      fancifulName: 'Black Widow',
      classType: 'other specialties & proprietaries',
      alcoholContent: '40% Alc./Vol.',
      origin: 'imported',
      country: 'canada'
    },
    imageAsset: {
      source: 'cola-cloud',
      filename: 'persian-empire-black-widow-distilled-spirits.webp'
    }
  },
  {
    id: 'leitz-rottland-wine',
    title: 'Leitz Rottland (imported German wine)',
    description:
      'Imported German wine with appellation and vintage. ABV often lands in review because 12.5% is small and stylised on the label; country-of-origin judgment tests Germany ↔ produit d’Allemagne equivalence.',
    beverageType: 'wine',
    fields: {
      ...emptyFields(),
      brandName: 'Leitz',
      fancifulName: 'Rottland',
      classType: 'table white wine',
      alcoholContent: '12.5% Alc./Vol.',
      origin: 'imported',
      country: 'germany',
      appellation: 'Rheingau',
      vintage: '2023'
    },
    imageAsset: {
      source: 'cola-cloud',
      filename: 'leitz-rottland-wine.webp'
    }
  },
  {
    id: 'lake-placid-shredder',
    title: 'Lake Placid Shredder (malt, decorative brand)',
    description:
      'Approved craft ale with a decorative brand mark. Exercises the VLM-trusted fields (brandName, fancifulName) that OCR can’t read cleanly. Warning is on the back label — expect it to stay in review.',
    beverageType: 'malt-beverage',
    fields: {
      ...emptyFields(),
      brandName: 'Lake Placid',
      fancifulName: 'Shredder',
      classType: 'ale',
      origin: 'domestic'
    },
    imageAsset: {
      source: 'cola-cloud',
      filename: 'lake-placid-shredder-malt-beverage.webp'
    }
  },
  {
    id: 'harpoon-ale',
    title: 'Harpoon Ale (malt, wrap-around label)',
    description:
      'Classic Boston brewery ale. The label is a wrap-around strip — the government warning is visible but rotated 90° on the right edge. Exercises the multi-angle warning OCV + rotation handling.',
    beverageType: 'malt-beverage',
    fields: {
      ...emptyFields(),
      brandName: 'Harpoon',
      fancifulName: 'Ale',
      classType: 'ale',
      alcoholContent: '5% Alc./Vol.',
      origin: 'domestic'
    },
    imageAsset: {
      source: 'cola-cloud',
      filename: 'harpoon-ale-malt-beverage.webp'
    }
  },
  {
    id: 'stormwood-semillon',
    title: 'Stormwood Semillon (imported NZ wine)',
    description:
      'Imported New Zealand wine. Class/type taxonomy maps "table white wine" (application) ↔ "SEMILLON" (label). Tests the class-type equivalence table.',
    beverageType: 'wine',
    fields: {
      ...emptyFields(),
      brandName: 'Stormwood Wines',
      fancifulName: 'Semillon',
      classType: 'table white wine',
      alcoholContent: '13% Alc./Vol.',
      origin: 'imported',
      country: 'new zealand',
      appellation: 'Waiheke Island',
      vintage: '2025'
    },
    imageAsset: {
      source: 'cola-cloud',
      filename: 'stormwood-wines-semillon-wine.webp'
    }
  },
  // ─── NEGATIVE CONTROLS (intentional defects, should reject or review) ───
  {
    id: 'abv-negative',
    title: 'ABV mismatch (should reject)',
    description:
      'Supplemental-generated defect: label ABV differs from application by more than tolerance. Expect a reject verdict driven by alcohol-content:fail.',
    beverageType: 'malt-beverage',
    fields: {
      ...emptyFields(),
      brandName: 'Lake Placid',
      fancifulName: 'Shredder',
      classType: 'ale',
      alcoholContent: '5% Alc./Vol.',
      origin: 'domestic'
    },
    imageAsset: {
      source: 'supplemental-generated',
      filename: 'lake-placid-shredder-abv-negative.webp'
    }
  },
  {
    id: 'warning-occluded',
    title: 'Warning occluded (should reject)',
    description:
      'Supplemental-generated defect: the mandatory government warning text is physically obscured on the label. Tests the warning OCV safety gate — a confident "all clear" from the VLM should NOT pass when OCV can’t verify the text.',
    beverageType: 'malt-beverage',
    fields: {
      ...emptyFields(),
      brandName: 'Lake Placid',
      fancifulName: 'Ridge Runner',
      classType: 'india pale ale',
      alcoholContent: '5% Alc./Vol.',
      origin: 'domestic'
    },
    imageAsset: {
      source: 'supplemental-generated',
      filename: 'lake-placid-ridge-runner-warning-occluded.webp'
    }
  },
  // ─── FORM-DATA SCENARIOS (no image; exercise intake-form behavior) ───
  {
    id: 'cosmetic-brand-casing',
    title: 'Cosmetic brand casing',
    description:
      'Application uppercases the brand ("STONES THROW"); the label (when uploaded) shows "Stone’s Throw". Demonstrates the case-difference → approve rule. No image attached — upload your own to test.',
    beverageType: 'distilled-spirits',
    fields: {
      ...emptyFields(),
      brandName: 'STONES THROW',
      classType: 'Kentucky Straight Bourbon Whiskey',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL',
      applicantAddress: 'Stone Throw Distilling Co., Louisville, KY',
      origin: 'domestic'
    }
  },
  {
    id: 'wine-vintage-no-appellation',
    title: 'Vintage without appellation',
    description:
      'TTB rule: a labeled vintage year requires an appellation (27 CFR 4). Application has vintage=2021 but appellation blank — expect a cross-field rule to flag this.',
    beverageType: 'wine',
    fields: {
      ...emptyFields(),
      brandName: 'Heritage Hill',
      classType: 'Red Wine',
      alcoholContent: '13.5% Alc./Vol.',
      netContents: '750 mL',
      applicantAddress: 'Heritage Hill Cellars, Napa, CA',
      origin: 'domestic',
      appellation: '',
      vintage: '2021',
      varietals: [varietal('Cabernet Sauvignon', '75'), varietal('Merlot', '10')]
    }
  },
  {
    id: 'beer-forbidden-abv-format',
    title: 'Beer with forbidden ABV format',
    description:
      'Malt beverage ABV written as "5.2% ABV" — TTB 27 CFR 7.65 forbids that exact phrasing. Expect abv-format-permitted to fail.',
    beverageType: 'malt-beverage',
    fields: {
      ...emptyFields(),
      brandName: 'Harbor Brewing',
      fancifulName: 'Lighthouse Lager',
      classType: 'Lager',
      alcoholContent: '5.2% ABV',
      netContents: '12 fl. oz.',
      applicantAddress: 'Harbor Brewing Co., Seattle, WA',
      origin: 'domestic'
    }
  }
];
