import type { BeverageSelection, IntakeFields, VarietalRow } from './types';

export interface SeedScenario {
  id: string;
  title: string;
  description: string;
  beverageType: BeverageSelection;
  fields: IntakeFields;
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

export const seedScenarios: SeedScenario[] = [
  {
    id: 'blank',
    title: 'Blank intake',
    description: 'Empty form, no image, no fields.',
    beverageType: 'auto',
    fields: emptyFields()
  },
  {
    id: 'perfect-spirit-label',
    title: 'Perfect spirit label',
    description: 'Baseline happy path — a clean distilled-spirits submission.',
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
  {
    id: 'spirit-warning-errors',
    title: 'Warning text defect (spirits)',
    description: 'Government warning has title case plus punctuation defects.',
    beverageType: 'distilled-spirits',
    fields: {
      ...emptyFields(),
      brandName: 'Ironwood',
      fancifulName: 'Reserve',
      classType: 'Vodka',
      alcoholContent: '40% Alc./Vol.',
      netContents: '1 L',
      applicantAddress: 'Ironwood Spirits LLC, Portland, OR',
      origin: 'domestic'
    }
  },
  {
    id: 'spirit-brand-case-mismatch',
    title: 'Cosmetic brand mismatch',
    description: 'Applicant casing differs from label — should downgrade to review.',
    beverageType: 'distilled-spirits',
    fields: {
      ...emptyFields(),
      brandName: 'STONE\'S THROW',
      classType: 'Kentucky Straight Bourbon Whiskey',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL',
      applicantAddress: 'Stone Throw Distilling Co., Louisville, KY',
      origin: 'domestic'
    }
  },
  {
    id: 'wine-missing-appellation',
    title: 'Wine missing appellation',
    description: 'Vintage and varietals present; appellation left blank.',
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
    description: 'Malt beverage ABV uses "ABV" — not permitted.',
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
  },
  {
    id: 'low-quality-image',
    title: 'Low-quality image',
    description: 'Blurry or low-confidence extraction should surface review.',
    beverageType: 'auto',
    fields: {
      ...emptyFields(),
      brandName: '',
      classType: '',
      alcoholContent: '',
      netContents: '',
      applicantAddress: ''
    }
  }
];
