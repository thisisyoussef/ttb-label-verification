import type { IntakeFields, ProcessingPhase, ResultVariantOverride } from '../types';
import { DEFAULT_FAILURE_MESSAGE } from '../reviewFailureMessage';
import type { BeverageSelection } from '../types';
import type { SampleFields } from './toolbenchSampleSupport';

export interface ToolbenchSampleLoadState {
  beverage: BeverageSelection;
  fields: IntakeFields;
  scenarioId: string;
  forceFailure: boolean;
  variantOverride: ResultVariantOverride;
  report: null;
  phase: ProcessingPhase;
  failureMessage: string;
}

export function buildToolbenchSampleLoadState(
  fields: SampleFields
): ToolbenchSampleLoadState {
  return {
    beverage: 'auto',
    fields: {
      brandName: fields.brandName,
      fancifulName: fields.fancifulName,
      classType: fields.classType,
      alcoholContent: fields.alcoholContent,
      netContents: fields.netContents,
      applicantAddress: fields.applicantAddress,
      origin: fields.origin === 'imported' ? 'imported' : 'domestic',
      country: fields.country,
      formulaId: fields.formulaId,
      appellation: fields.appellation,
      vintage: fields.vintage,
      varietals: []
    },
    scenarioId: 'blank',
    forceFailure: false,
    variantOverride: 'auto',
    report: null,
    phase: 'running',
    failureMessage: DEFAULT_FAILURE_MESSAGE
  };
}
