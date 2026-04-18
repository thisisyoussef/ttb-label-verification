import {
  type OriginChoice,
  type ReviewError,
  reviewIntakeFieldsSchema,
  type ReviewIntakeBeverage,
  type ReviewIntakeFields
} from '../shared/contracts/review';

export type MemoryUploadedLabel = Express.Multer.File;

export interface NormalizedReviewVarietal {
  name?: string;
  percentage?: string;
}

export interface NormalizedReviewFields {
  beverageTypeHint: ReviewIntakeBeverage;
  origin: OriginChoice;
  brandName?: string;
  fancifulName?: string;
  classType?: string;
  alcoholContent?: string;
  netContents?: string;
  applicantAddress?: string;
  country?: string;
  formulaId?: string;
  appellation?: string;
  vintage?: string;
  varietals: NormalizedReviewVarietal[];
}

export interface ParsedReviewFields {
  fields: NormalizedReviewFields;
  hasApplicationData: boolean;
}

export interface NormalizedUploadedLabel {
  originalName: string;
  mimeType: MemoryUploadedLabel['mimetype'];
  bytes: number;
  buffer: Buffer;
}

export interface NormalizedReviewIntake {
  label: NormalizedUploadedLabel;
  labels: NormalizedUploadedLabel[];
  fields: NormalizedReviewFields;
  hasApplicationData: boolean;
  standalone: boolean;
  /** Pre-extracted OCR text from the Tesseract pre-pass, when available. */
  ocrText?: string;
}

type ReviewFieldsParseFailure = {
  success: false;
  status: number;
  error: ReviewError;
};

type ReviewFieldsParseSuccess = {
  success: true;
  value: ParsedReviewFields;
};

export type ReviewFieldsParseResult =
  | ReviewFieldsParseFailure
  | ReviewFieldsParseSuccess;

const EMPTY_REVIEW_FIELDS: ReviewIntakeFields = {
  beverageType: 'auto',
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

export function parseOptionalReviewFields(rawFields: unknown): ReviewFieldsParseResult {
  if (rawFields === undefined || rawFields === null) {
    return successResult(EMPTY_REVIEW_FIELDS);
  }

  if (typeof rawFields !== 'string') {
    return invalidFieldsResult('We could not read the application fields for this review.');
  }

  const trimmedFields = rawFields.trim();
  if (trimmedFields.length === 0) {
    return successResult(EMPTY_REVIEW_FIELDS);
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(trimmedFields);
  } catch {
    return invalidFieldsResult('We could not read the application fields for this review.');
  }

  const result = reviewIntakeFieldsSchema.safeParse(parsedJson);
  if (!result.success) {
    return invalidFieldsResult('Some application fields were not in the expected format.');
  }

  return successResult(result.data);
}

export function createNormalizedReviewIntake(input: {
  file?: MemoryUploadedLabel;
  files?: MemoryUploadedLabel[];
  fields: ParsedReviewFields;
}): NormalizedReviewIntake {
  const files =
    input.files ??
    (input.file ? [input.file] : []);

  if (files.length === 0) {
    throw new Error('At least one uploaded label is required.');
  }

  const labels = files.map(toNormalizedUploadedLabel);

  return {
    label: labels[0]!,
    labels,
    fields: input.fields.fields,
    hasApplicationData: input.fields.hasApplicationData,
    standalone: !input.fields.hasApplicationData
  };
}

function toNormalizedUploadedLabel(file: MemoryUploadedLabel): NormalizedUploadedLabel {
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    bytes: file.size,
    buffer: file.buffer
  };
}

function successResult(fields: ReviewIntakeFields): ReviewFieldsParseSuccess {
  const normalizedFields = normalizeReviewFields(fields);

  return {
    success: true,
    value: {
      fields: normalizedFields,
      hasApplicationData: detectApplicationData(normalizedFields)
    }
  };
}

function invalidFieldsResult(message: string): ReviewFieldsParseFailure {
  return {
    success: false,
    status: 400,
    error: {
      kind: 'validation',
      message,
      retryable: false
    }
  };
}

function normalizeReviewFields(fields: ReviewIntakeFields): NormalizedReviewFields {
  return {
    beverageTypeHint: fields.beverageType,
    origin: fields.origin,
    brandName: normalizeOptionalText(fields.brandName),
    fancifulName: normalizeOptionalText(fields.fancifulName),
    classType: normalizeOptionalText(fields.classType),
    alcoholContent: normalizeOptionalText(fields.alcoholContent),
    netContents: normalizeOptionalText(fields.netContents),
    applicantAddress: normalizeOptionalText(fields.applicantAddress),
    country: normalizeOptionalText(fields.country),
    formulaId: normalizeOptionalText(fields.formulaId),
    appellation: normalizeOptionalText(fields.appellation),
    vintage: normalizeOptionalText(fields.vintage),
    varietals: fields.varietals
      .map((row) => ({
        name: normalizeOptionalText(row.name),
        percentage: normalizeOptionalText(row.percentage)
      }))
      .filter((row) => row.name || row.percentage)
  };
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function detectApplicationData(fields: NormalizedReviewFields): boolean {
  return Boolean(
    fields.brandName ||
      fields.fancifulName ||
      fields.classType ||
      fields.alcoholContent ||
      fields.netContents ||
      fields.applicantAddress ||
      fields.country ||
      fields.formulaId ||
      fields.appellation ||
      fields.vintage ||
      fields.varietals.length > 0
  );
}
