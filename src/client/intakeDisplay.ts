import type { BeverageSelection, IntakeFields } from './types';

export function hasWineDetails(fields: IntakeFields): boolean {
  return (
    fields.appellation.trim().length > 0 ||
    fields.vintage.trim().length > 0 ||
    fields.varietals.some(
      (row) => row.name.trim().length > 0 || row.percentage.trim().length > 0
    )
  );
}

export function shouldShowWineFields(input: {
  beverage: BeverageSelection;
  fields: IntakeFields;
  revealWineFields: boolean;
}) {
  return (
    input.beverage === 'wine' ||
    (input.beverage === 'auto' &&
      (input.revealWineFields || hasWineDetails(input.fields)))
  );
}
