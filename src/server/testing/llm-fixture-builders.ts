import type {
  BeverageType,
  OriginChoice,
  ReviewIntakeBeverage,
  VisualSignalStatus
} from '../../shared/contracts/review-base';

type RawExtractionField = {
  present: boolean;
  value: string | null;
  confidence: number;
  note: string | null;
};

type RawWarningSignal = {
  status: VisualSignalStatus;
  confidence: number;
  note: string | null;
};

export type RawReviewModelOutput = {
  beverageTypeHint: BeverageType | null;
  fields: {
    brandName: RawExtractionField;
    fancifulName: RawExtractionField;
    classType: RawExtractionField;
    alcoholContent: RawExtractionField;
    netContents: RawExtractionField;
    applicantAddress: RawExtractionField;
    countryOfOrigin: RawExtractionField;
    ageStatement: RawExtractionField;
    sulfiteDeclaration: RawExtractionField;
    appellation: RawExtractionField;
    vintage: RawExtractionField;
    governmentWarning: RawExtractionField;
    varietals: Array<{
      name: string;
      percentage: string | null;
      confidence: number;
      note: string | null;
    }>;
  };
  warningSignals: {
    prefixAllCaps: RawWarningSignal;
    prefixBold: RawWarningSignal;
    continuousParagraph: RawWarningSignal;
    separateFromOtherContent: RawWarningSignal;
  };
  imageQuality: {
    score: number;
    issues: string[];
    noTextDetected: boolean;
    note: string | null;
  };
  summary: string;
};

export const CANONICAL_WARNING_TEXT =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';

export function presentModelField(
  value: string,
  confidence = 0.96,
  note: string | null = null
): RawExtractionField {
  return {
    present: true,
    value,
    confidence,
    note
  };
}

export function absentModelField(
  confidence = 0.08,
  note: string | null = null
): RawExtractionField {
  return {
    present: false,
    value: null,
    confidence,
    note
  };
}

export function buildWarningSignal(
  status: VisualSignalStatus,
  confidence = 0.92,
  note: string | null = null
): RawWarningSignal {
  return {
    status,
    confidence,
    note
  };
}

export function buildReviewFormFields(
  overrides: Partial<{
    beverageType: ReviewIntakeBeverage;
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
    varietals: Array<{ name: string; percentage: string }>;
  }> = {}
) {
  return {
    beverageType: 'auto' as ReviewIntakeBeverage,
    brandName: '',
    fancifulName: '',
    classType: '',
    alcoholContent: '',
    netContents: '',
    applicantAddress: '',
    origin: 'domestic' as OriginChoice,
    country: '',
    formulaId: '',
    appellation: '',
    vintage: '',
    varietals: [] as Array<{ name: string; percentage: string }>,
    ...overrides
  };
}

export function buildRawReviewModelOutput(
  overrides: Omit<
    Partial<RawReviewModelOutput>,
    'fields' | 'warningSignals' | 'imageQuality'
  > & {
    fields?: Partial<RawReviewModelOutput['fields']>;
    warningSignals?: Partial<RawReviewModelOutput['warningSignals']>;
    imageQuality?: Partial<RawReviewModelOutput['imageQuality']>;
  } = {}
): RawReviewModelOutput {
  const base: RawReviewModelOutput = {
    beverageTypeHint: 'distilled-spirits',
    fields: {
      brandName: presentModelField('Trace Brand', 0.97),
      fancifulName: absentModelField(),
      classType: presentModelField('Vodka', 0.93),
      alcoholContent: presentModelField('45% Alc./Vol.', 0.91),
      netContents: presentModelField('750 mL', 0.92),
      applicantAddress: absentModelField(),
      countryOfOrigin: absentModelField(),
      ageStatement: absentModelField(),
      sulfiteDeclaration: absentModelField(),
      appellation: absentModelField(),
      vintage: absentModelField(),
      governmentWarning: presentModelField(CANONICAL_WARNING_TEXT, 0.97),
      varietals: []
    },
    warningSignals: {
      prefixAllCaps: buildWarningSignal('yes', 0.98),
      prefixBold: buildWarningSignal('yes', 0.91),
      continuousParagraph: buildWarningSignal('yes', 0.9),
      separateFromOtherContent: buildWarningSignal('yes', 0.88)
    },
    imageQuality: {
      score: 0.95,
      issues: [],
      noTextDetected: false,
      note: null
    },
    summary: 'Structured extraction completed successfully.'
  };

  return {
    ...base,
    ...overrides,
    fields: {
      ...base.fields,
      ...overrides.fields
    },
    warningSignals: {
      ...base.warningSignals,
      ...overrides.warningSignals
    },
    imageQuality: {
      ...base.imageQuality,
      ...overrides.imageQuality
    }
  };
}
