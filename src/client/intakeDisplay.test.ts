import { describe, expect, it } from 'vitest';

import type { IntakeFields } from './types';
import { hasWineDetails, shouldShowWineFields } from './intakeDisplay';

function buildFields(overrides: Partial<IntakeFields> = {}): IntakeFields {
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
    varietals: [],
    ...overrides
  };
}

describe('hasWineDetails', () => {
  it('returns false when wine-only fields are empty', () => {
    expect(hasWineDetails(buildFields())).toBe(false);
  });

  it('returns true when appellation, vintage, or varietals are present', () => {
    expect(hasWineDetails(buildFields({ appellation: 'Rheingau' }))).toBe(true);
    expect(hasWineDetails(buildFields({ vintage: '2024' }))).toBe(true);
    expect(
      hasWineDetails(
        buildFields({
          varietals: [{ id: 'varietal-1', name: 'Riesling', percentage: '' }]
        })
      )
    ).toBe(true);
  });
});

describe('shouldShowWineFields', () => {
  it('always shows wine fields when wine is explicitly selected', () => {
    expect(
      shouldShowWineFields({
        beverage: 'wine',
        fields: buildFields(),
        revealWineFields: false
      })
    ).toBe(true);
  });

  it('keeps wine fields hidden for auto until explicitly revealed or prefilled', () => {
    expect(
      shouldShowWineFields({
        beverage: 'auto',
        fields: buildFields(),
        revealWineFields: false
      })
    ).toBe(false);

    expect(
      shouldShowWineFields({
        beverage: 'auto',
        fields: buildFields(),
        revealWineFields: true
      })
    ).toBe(true);

    expect(
      shouldShowWineFields({
        beverage: 'auto',
        fields: buildFields({ vintage: '2024' }),
        revealWineFields: false
      })
    ).toBe(true);
  });
});
