import {
  BATCH_CSV_EXPECTED_HEADERS,
  BATCH_CSV_REQUIRED_HEADERS,
  batchCsvRowSchema,
  type BatchCsvRow,
  type OriginChoice,
  type ReviewIntakeBeverage
} from '../shared/contracts/review';

export interface ParsedBatchCsvRow {
  id: string;
  rowIndex: number;
  filenameHint: string;
  brandName: string;
  classType: string;
  beverageType: ReviewIntakeBeverage;
  fancifulName: string;
  alcoholContent: string;
  netContents: string;
  applicantAddress: string;
  origin: OriginChoice;
  country: string;
  formulaId: string;
  appellation: string;
  vintage: string;
}

type BatchCsvPreview = {
  rowCount: number;
  headers: string[];
  rows: BatchCsvRow[];
};

type BatchCsvSuccess = {
  success: true;
  headers: string[];
  rows: ParsedBatchCsvRow[];
  preview: BatchCsvPreview;
};

type BatchCsvFailure = {
  success: false;
  error: {
    message: string;
  };
};

export type BatchCsvParseResult = BatchCsvSuccess | BatchCsvFailure;

export function parseBatchCsv(input: {
  filename: string;
  text: string;
}): BatchCsvParseResult {
  try {
    const rows = parseCsvRecords(stripBom(input.text));

    if (rows.length === 0) {
      return failure('This CSV could not be read. Check the headers and try again.');
    }

    const rawHeaders = rows[0]!.map((value) => value.trim());
    if (rawHeaders.length === 0 || rawHeaders.every((value) => value.length === 0)) {
      return failure('This CSV could not be read. Check the headers and try again.');
    }

    const missingRequired = BATCH_CSV_REQUIRED_HEADERS.filter(
      (header) => !rawHeaders.includes(header)
    );
    if (missingRequired.length > 0) {
      return failure(`Missing required: ${missingRequired.join(', ')}`);
    }

    const dataRows = rows
      .slice(1)
      .filter((row) => row.some((value) => value.trim().length > 0));
    if (dataRows.length === 0) {
      return failure('This CSV could not be read. Check the headers and try again.');
    }

    const headerIndex = new Map<string, number>();
    rawHeaders.forEach((header, index) => {
      headerIndex.set(header, index);
    });

    const parsedRows = dataRows.map((row, index) => {
      if (row.length !== rawHeaders.length) {
        throw new BatchCsvParseError(
          `Row ${index + 1} did not match the header column count.`
        );
      }

      const valueFor = (header: (typeof BATCH_CSV_EXPECTED_HEADERS)[number]) =>
        row[headerIndex.get(header) ?? -1]?.trim() ?? '';

      return {
        id: `row-${index + 1}`,
        rowIndex: index + 1,
        filenameHint: valueFor('filename'),
        beverageType: normalizeBeverageType(valueFor('beverage_type')),
        brandName: valueFor('brand_name'),
        fancifulName: valueFor('fanciful_name'),
        classType: valueFor('class_type'),
        alcoholContent: valueFor('alcohol_content'),
        netContents: valueFor('net_contents'),
        applicantAddress: valueFor('applicant_address'),
        origin: normalizeOrigin(valueFor('origin')),
        country: valueFor('country'),
        formulaId: valueFor('formula_id'),
        appellation: valueFor('appellation'),
        vintage: valueFor('vintage')
      } satisfies ParsedBatchCsvRow;
    });

    const previewRows = parsedRows.map((row) =>
      batchCsvRowSchema.parse({
        id: row.id,
        rowIndex: row.rowIndex,
        filenameHint: row.filenameHint,
        brandName: row.brandName,
        classType: row.classType
      })
    );

    return {
      success: true,
      headers: rawHeaders,
      rows: parsedRows,
      preview: {
        rowCount: parsedRows.length,
        headers: rawHeaders,
        rows: previewRows
      }
    };
  } catch (error) {
    if (error instanceof BatchCsvParseError) {
      return failure(error.message);
    }

    throw error;
  }
}

class BatchCsvParseError extends Error {}

function failure(message: string): BatchCsvFailure {
  return {
    success: false,
    error: {
      message
    }
  };
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function normalizeBeverageType(value: string): ReviewIntakeBeverage {
  if (
    value === 'distilled-spirits' ||
    value === 'wine' ||
    value === 'malt-beverage'
  ) {
    return value;
  }

  return 'auto';
}

function normalizeOrigin(value: string): OriginChoice {
  return value === 'imported' ? 'imported' : 'domestic';
}

function parseCsvRecords(value: string) {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const pushField = () => {
    currentRecord.push(currentField);
    currentField = '';
  };

  const pushRecord = () => {
    pushField();
    records.push(currentRecord);
    currentRecord = [];
  };

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    const next = value[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      pushField();
      continue;
    }

    if (!inQuotes && char === '\n') {
      pushRecord();
      continue;
    }

    if (!inQuotes && char === '\r') {
      if (next === '\n') {
        continue;
      }
      pushRecord();
      continue;
    }

    currentField += char;
  }

  if (inQuotes) {
    throw new BatchCsvParseError('This CSV could not be read. Check the headers and try again.');
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    pushRecord();
  }

  return records;
}
