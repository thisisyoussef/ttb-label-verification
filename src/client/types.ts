import type {
  BeverageType,
  CheckReview,
  CheckStatus,
  ComparisonEvidence,
  ComparisonStatus,
  DiffSegment,
  DiffSegmentKind,
  ExtractionQuality,
  ExtractionQualityState,
  Severity,
  VerificationCounts,
  VerificationReport,
  Verdict,
  WarningEvidence,
  WarningSubCheck,
  WarningSubCheckId
} from '../shared/contracts/review';

export type BeverageSelection = BeverageType | 'auto';

export type OriginChoice = 'domestic' | 'imported';

export interface VarietalRow {
  id: string;
  name: string;
  percentage: string;
}

export interface IntakeFields {
  brandName: string;
  fancifulName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  applicantAddress: string;
  origin: OriginChoice;
  country: string;
  formulaId: string;
  appellation: string;
  vintage: string;
  varietals: VarietalRow[];
}

export interface LabelImage {
  file: File;
  previewUrl: string;
  sizeLabel: string;
}

export type DropZoneError =
  | { kind: 'unsupported'; message: string }
  | { kind: 'oversized'; message: string };

export type ProcessingStepId =
  | 'reading-image'
  | 'extracting-fields'
  | 'detecting-beverage'
  | 'running-checks'
  | 'preparing-evidence';

export type ProcessingStepStatus = 'pending' | 'active' | 'done' | 'failed';

export interface ProcessingStep {
  id: ProcessingStepId;
  label: string;
  status: ProcessingStepStatus;
}

export type ProcessingPhase = 'running' | 'failed' | 'terminal';

export type CheckSeverity = Severity;
export type UIVerificationReport = VerificationReport;
export type {
  CheckReview,
  CheckStatus,
  ComparisonEvidence,
  ComparisonStatus,
  DiffSegment,
  DiffSegmentKind,
  ExtractionQuality,
  ExtractionQualityState,
  VerificationCounts,
  Verdict,
  WarningEvidence,
  WarningSubCheck,
  WarningSubCheckId
};

export type ResultsMode = 'comparison' | 'standalone' | 'no-text';

export type ResultVariantOverride = 'auto' | 'standalone' | 'no-text-extracted';
