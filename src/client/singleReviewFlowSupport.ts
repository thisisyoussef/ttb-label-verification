import type { SeedScenario } from './scenarios';
import type { ReviewRelevanceResult } from '../shared/contracts/review';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  ProcessingPhase,
  ProcessingStep,
  ResultVariantOverride,
  UIVerificationReport
} from './types';
import type { OcrPreviewFields } from './useOcrPreview';
import type { RefineStatus } from './useRefineReview';

export type ReviewVariantOption = {
  value: ResultVariantOverride;
  label: string;
};

export const REVIEW_VARIANT_OPTIONS: ReviewVariantOption[] = [
  { value: 'auto', label: 'Auto (by scenario)' },
  { value: 'standalone', label: 'Standalone (no app data)' },
  { value: 'no-text-extracted', label: 'No-text-extracted' }
];

export function cloneScenarioFields(scenario: SeedScenario): IntakeFields {
  return {
    ...scenario.fields,
    varietals: scenario.fields.varietals.map((row) => ({ ...row }))
  };
}

export interface SingleReviewFlow {
  image: LabelImage | null;
  secondaryImage: LabelImage | null;
  beverage: BeverageSelection;
  fields: IntakeFields;
  scenarioId: string;
  forceFailure: boolean;
  variantOverride: ResultVariantOverride;
  steps: ProcessingStep[];
  phase: ProcessingPhase;
  failureMessage: string;
  report: UIVerificationReport | null;
  ocrPreview: OcrPreviewFields | null;
  reviewRelevance: ReviewRelevanceResult | null;
  reviewRelevancePending: boolean;
  refineStatus: RefineStatus;
  variantOptions: ReviewVariantOption[];
  setBeverage: (value: BeverageSelection) => void;
  setFields: (value: IntakeFields) => void;
  setForceFailure: (value: boolean) => void;
  setVariantOverride: (value: ResultVariantOverride) => void;
  onVerify: () => void;
  onContinueAfterRelevanceWarning: () => void;
  onCancel: () => void;
  onBackToIntake: () => void;
  onRetry: () => void;
  onImageChange: (next: LabelImage | null) => void;
  onSecondaryImageChange: (next: LabelImage | null) => void;
  onImagesChange: (
    primary: LabelImage | null,
    secondary?: LabelImage | null
  ) => void;
  onClear: () => void;
  onSelectScenario: (scenario: SeedScenario) => void;
  onLoadTourScenario: (scenario: SeedScenario) => void;
  onShowTourResults: (
    scenario: SeedScenario,
    variant?: ResultVariantOverride
  ) => void;
  onNewReview: () => void;
  onRunFullComparison: () => void;
  onTryAnotherImage: () => void;
  onContinueWithCaution: () => void;
  onExportResults: () => void;
  reset: () => void;
}

export function resolveVerifyIntent(input: {
  hasImage: boolean;
  relevance: ReviewRelevanceResult | null;
}) {
  if (!input.hasImage) {
    return 'disabled' as const;
  }

  if (input.relevance?.decision === 'unlikely-label') {
    return 'confirm-unlikely' as const;
  }

  return 'submit' as const;
}
