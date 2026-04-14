import {
  CSV_EXPECTED_HEADERS,
  type BatchAmbiguousItem,
  type BatchCsv,
  type BatchCsvRow,
  type BatchFileError,
  type BatchLabelImage,
  type BatchMatchedPair,
  type BatchMatchingState,
  type BatchStreamItem,
  type BatchUnmatchedImage,
  type BatchUnmatchedRow
} from './batchTypes';
import { buildLabelThumbnail } from './labelThumbnail';

function labelImage(
  id: string,
  filename: string,
  sizeLabel: string,
  preview: { brandName: string; classType: string } | null,
  isPdf = false
): BatchLabelImage {
  return {
    id,
    file: null,
    filename,
    previewUrl: preview ? buildLabelThumbnail(preview) : null,
    sizeLabel,
    isPdf
  };
}

function csvRow(
  id: string,
  rowIndex: number,
  filenameHint: string,
  brandName: string,
  classType: string
): BatchCsvRow {
  return { id, rowIndex, filenameHint, brandName, classType };
}

export interface SeedBatch {
  id: string;
  label: string;
  description: string;
  images: BatchLabelImage[];
  csv: BatchCsv | null;
  csvError: string | null;
  fileErrors: BatchFileError[];
  overCap: boolean;
  matching: BatchMatchingState;
}

const IMAGES_SIX: BatchLabelImage[] = [
  labelImage('img-1', 'old-oak-bourbon.jpg', '2.8 MB', {
    brandName: 'Old Oak Bourbon',
    classType: 'Kentucky Straight Bourbon'
  }),
  labelImage('img-2', 'stones-throw-gin.jpg', '3.1 MB', {
    brandName: "Stone's Throw Gin",
    classType: 'Small Batch Gin'
  }),
  labelImage('img-3', 'brand-case-mismatch.png', '1.9 MB', {
    brandName: 'Stone Throw Gin',
    classType: 'Small Batch Gin'
  }),
  labelImage('img-4', 'vintners-red-2021.jpg', '4.2 MB', {
    brandName: 'Vintner Red 2021',
    classType: 'Napa Valley Cabernet'
  }),
  labelImage('img-5', 'hop-barrel-lager.webp', '1.4 MB', {
    brandName: 'Hop Barrel Lager',
    classType: 'American Lager'
  }),
  labelImage('img-6', 'low-quality-scan.pdf', '5.6 MB', null, true)
];

const ROWS_SIX: BatchCsvRow[] = [
  csvRow('row-1', 1, 'old-oak-bourbon.jpg', 'Old Oak Bourbon', 'Kentucky Straight Bourbon'),
  csvRow('row-2', 2, 'stones-throw-gin.jpg', "Stone's Throw Gin", 'Small Batch Gin'),
  csvRow('row-3', 3, 'brand-case-mismatch.png', 'Stone Throw Gin', 'Small Batch Gin'),
  csvRow('row-4', 4, 'vintners-red-2021.jpg', 'Vintner Red 2021', 'Napa Valley Cabernet'),
  csvRow('row-5', 5, 'hop-barrel-lager.webp', 'Hop Barrel Lager', 'American Lager'),
  csvRow('row-6', 6, 'low-quality-scan.pdf', 'Heritage Whiskey', 'Tennessee Whiskey')
];

function seedCleanSix(): SeedBatch {
  const matched: BatchMatchedPair[] = IMAGES_SIX.map((image, index) => ({
    image,
    row: ROWS_SIX[index]!,
    source: 'filename'
  }));
  return {
    id: 'seed-clean-six',
    label: 'Clean six-label batch',
    description:
      'All six eval scenarios matched by filename. Primary action is enabled.',
    images: IMAGES_SIX,
    csv: {
      filename: 'applications.csv',
      sizeLabel: '3.4 KB',
      rowCount: ROWS_SIX.length,
      headers: CSV_EXPECTED_HEADERS,
      rows: ROWS_SIX
    },
    fileErrors: [],
    csvError: null,
    overCap: false,
    matching: {
      matched,
      ambiguous: [],
      unmatchedImages: [],
      unmatchedRows: []
    }
  };
}

function seedMixedWithBlockers(): SeedBatch {
  const images: BatchLabelImage[] = [
    labelImage('img-m-1', 'old-oak-bourbon.jpg', '2.8 MB', {
      brandName: 'Old Oak Bourbon',
      classType: 'Kentucky Straight Bourbon'
    }),
    labelImage('img-m-2', 'label_v2.png', '2.1 MB', {
      brandName: "Stone's Throw Gin",
      classType: '750 mL'
    }),
    labelImage('img-m-3', 'unknown_asset.jpg', '1.7 MB', {
      brandName: 'Unknown Label',
      classType: 'No metadata'
    }),
    labelImage('img-m-4', 'vintners-red-2021.jpg', '4.2 MB', {
      brandName: 'Vintner Red 2021',
      classType: 'Napa Valley Cabernet'
    }),
    labelImage('img-m-5', 'hop-barrel-lager.webp', '1.4 MB', {
      brandName: 'Hop Barrel Lager',
      classType: 'American Lager'
    })
  ];
  const rows: BatchCsvRow[] = [
    csvRow('row-m-1', 1, 'old-oak-bourbon.jpg', 'Old Oak Bourbon', 'Kentucky Straight Bourbon'),
    csvRow('row-m-2', 2, 'stones-throw-gin.jpg', "Stone's Throw Gin", '750 mL'),
    csvRow('row-m-3', 3, 'stones-throw-gin-1750.jpg', "Stone's Throw Gin", '1.75 L'),
    csvRow('row-m-4', 4, 'vintners-red-2021.jpg', 'Vintner Red 2021', 'Napa Valley Cabernet'),
    csvRow('row-m-5', 5, 'hop-barrel-lager.webp', 'Hop Barrel Lager', 'American Lager'),
    csvRow('row-m-6', 6, 'mountain-ridge-whiskey.jpg', 'Mountain Ridge Whiskey', 'Tennessee Whiskey')
  ];
  const matched: BatchMatchedPair[] = [
    { image: images[0]!, row: rows[0]!, source: 'filename' },
    { image: images[3]!, row: rows[3]!, source: 'filename' },
    { image: images[4]!, row: rows[4]!, source: 'filename' }
  ];
  const ambiguous: BatchAmbiguousItem[] = [
    {
      image: images[1]!,
      candidates: [rows[1]!, rows[2]!],
      chosenRowId: null,
      dropped: false
    }
  ];
  const unmatchedImages: BatchUnmatchedImage[] = [
    { image: images[2]!, pairedRowId: null, dropped: false }
  ];
  const unmatchedRows: BatchUnmatchedRow[] = [
    { row: rows[5]!, pairedImageId: null, dropped: false }
  ];
  return {
    id: 'seed-mixed-blockers',
    label: 'Mixed match with ambiguity',
    description:
      'Three clean matches, one ambiguous image (two candidate rows), one unmatched image, one unmatched row. Primary action is disabled until resolved.',
    images,
    csv: {
      filename: 'applications.csv',
      sizeLabel: '4.1 KB',
      rowCount: rows.length,
      headers: CSV_EXPECTED_HEADERS,
      rows
    },
    fileErrors: [],
    csvError: null,
    overCap: false,
    matching: {
      matched,
      ambiguous,
      unmatchedImages,
      unmatchedRows
    }
  };
}

function seedFileErrors(): SeedBatch {
  const base = seedCleanSix();
  const fileErrors: BatchFileError[] = [
    {
      filename: 'giant-poster.png',
      reason: 'oversized',
      message: 'giant-poster.png is larger than 10 MB.'
    },
    {
      filename: 'menu.docx',
      reason: 'unsupported-type',
      message: "menu.docx isn't a supported image type."
    },
    {
      filename: 'old-oak-bourbon.jpg',
      reason: 'duplicate',
      message: 'old-oak-bourbon.jpg matches an image already in this batch.'
    }
  ];
  return {
    ...base,
    id: 'seed-file-errors',
    label: 'File errors alongside a clean match',
    description:
      'Clean six-label match, plus three file-error rows surfacing above the matched list.',
    fileErrors
  };
}

function seedEmpty(): SeedBatch {
  return {
    id: 'seed-empty',
    label: 'Empty',
    description: 'Both drop zones untouched. Primary action is unavailable.',
    images: [],
    csv: null,
    csvError: null,
    overCap: false,
    fileErrors: [],
    matching: {
      matched: [],
      ambiguous: [],
      unmatchedImages: [],
      unmatchedRows: []
    }
  };
}

function seedImagesOnly(): SeedBatch {
  return {
    id: 'seed-images-only',
    label: 'Images only',
    description: 'Five images uploaded, no CSV yet.',
    images: IMAGES_SIX.slice(0, 5),
    csv: null,
    csvError: null,
    overCap: false,
    fileErrors: [],
    matching: {
      matched: [],
      ambiguous: [],
      unmatchedImages: [],
      unmatchedRows: []
    }
  };
}

function seedCsvOnly(): SeedBatch {
  return {
    id: 'seed-csv-only',
    label: 'CSV only',
    description: 'Six CSV rows, no images yet.',
    images: [],
    csv: {
      filename: 'applications.csv',
      sizeLabel: '3.4 KB',
      rowCount: ROWS_SIX.length,
      headers: CSV_EXPECTED_HEADERS,
      rows: ROWS_SIX
    },
    csvError: null,
    overCap: false,
    fileErrors: [],
    matching: {
      matched: [],
      ambiguous: [],
      unmatchedImages: [],
      unmatchedRows: []
    }
  };
}

function seedCsvError(): SeedBatch {
  return {
    id: 'seed-csv-error',
    label: 'CSV error',
    description:
      'Images present, CSV failed to parse. Matching is blocked until the CSV is fixed.',
    images: IMAGES_SIX.slice(0, 4),
    csv: {
      filename: 'applications-broken.csv',
      sizeLabel: '1.1 KB',
      rowCount: 0,
      headers: [],
      rows: []
    },
    csvError: 'This CSV could not be read. Check the headers and try again.',
    overCap: false,
    fileErrors: [],
    matching: {
      matched: [],
      ambiguous: [],
      unmatchedImages: [],
      unmatchedRows: []
    }
  };
}

function seedOverCap(): SeedBatch {
  const clean = seedCleanSix();
  return {
    ...clean,
    id: 'seed-over-cap',
    label: 'Over cap',
    description:
      'Reviewer tried to drop more than 50 images; overflow was rejected with an explicit message.',
    overCap: true,
    fileErrors: [
      {
        filename: 'additional-batch-drop.jpg',
        reason: 'over-cap',
        message:
          'This proof of concept accepts up to 50 labels per batch. Remove some to continue.'
      }
    ]
  };
}

export const SEED_BATCHES: SeedBatch[] = [
  seedCleanSix(),
  seedMixedWithBlockers(),
  seedFileErrors(),
  seedEmpty(),
  seedImagesOnly(),
  seedCsvOnly(),
  seedCsvError(),
  seedOverCap()
];

export function findSeedBatch(id: string): SeedBatch {
  const found = SEED_BATCHES.find((batch) => batch.id === id);
  if (!found) {
    throw new Error(`Unknown seed batch: ${id}`);
  }
  return found;
}

export const DEFAULT_SEED_BATCH_ID = 'seed-clean-six';

export interface StreamSeed {
  id: string;
  label: string;
  description: string;
  total: number;
  items: BatchStreamItem[];
  doneOverride?: number;
  secondsRemaining?: number;
}

function streamItem(
  id: string,
  filename: string,
  identity: string,
  status: BatchStreamItem['status'],
  errorMessage?: string
): BatchStreamItem {
  const { brandName, classType } = splitIdentity(identity);
  const isPdf = filename.toLowerCase().endsWith('.pdf');
  const base: BatchStreamItem = {
    id,
    filename,
    identity,
    previewUrl: isPdf ? null : buildLabelThumbnail({ brandName, classType }),
    isPdf,
    status,
    retryKey: 0
  };
  if (errorMessage !== undefined) base.errorMessage = errorMessage;
  return base;
}

function splitIdentity(identity: string): { brandName: string; classType: string } {
  const [brandPart = identity, ...rest] = identity.split(' — ');
  return {
    brandName: brandPart,
    classType: rest.join(' — ')
  };
}

export const STREAM_RUNNING_MIXED: StreamSeed = {
  id: 'stream-running-mixed',
  label: 'Mid-run, mixed outcomes',
  description:
    'Seven of twelve complete, one inline error with retry available, remaining items still to stream in.',
  total: 12,
  doneOverride: 7,
  secondsRemaining: 24,
  items: [
    streamItem('s-7', 'hop-barrel-lager.webp', 'Hop Barrel Lager — American Lager', 'fail'),
    streamItem('s-6', 'low-quality-scan.pdf', 'Heritage Whiskey — Tennessee Whiskey', 'review'),
    streamItem(
      's-5',
      'casa-vieja.jpg',
      'Casa Vieja — Añejo Tequila',
      'error',
      'The connection dropped before this item finished.'
    ),
    streamItem('s-4', 'brand-case-mismatch.png', 'Stone Throw Gin — Small Batch Gin', 'review'),
    streamItem('s-3', 'vintners-red-2021.jpg', 'Vintner Red 2021 — Napa Valley Cabernet', 'fail'),
    streamItem('s-2', "stones-throw-gin.jpg", "Stone's Throw Gin — Small Batch Gin", 'pass'),
    streamItem('s-1', 'old-oak-bourbon.jpg', 'Old Oak Bourbon — Kentucky Straight Bourbon', 'pass')
  ]
};

export const STREAM_TERMINAL_MIXED: StreamSeed = {
  id: 'stream-terminal-mixed',
  label: 'Terminal — mixed outcomes',
  description: '12 of 12 complete with a realistic spread of outcomes.',
  total: 12,
  doneOverride: 12,
  secondsRemaining: 0,
  items: [
    streamItem('t-12', 'label-12.jpg', 'Midnight Rum — Aged 5 Years', 'pass'),
    streamItem('t-11', 'label-11.jpg', 'Clear Creek Vodka — Silver', 'review'),
    streamItem('t-10', 'label-10.jpg', 'Highland Scotch — 12 Year', 'pass'),
    streamItem('t-9', 'label-09.jpg', 'Coastal IPA — Session Strength', 'fail'),
    streamItem('t-8', 'label-08.jpg', 'Cellar Reserve Riesling — 2022', 'pass'),
    streamItem('t-7', 'hop-barrel-lager.webp', 'Hop Barrel Lager — American Lager', 'fail'),
    streamItem('t-6', 'low-quality-scan.pdf', 'Heritage Whiskey — Tennessee Whiskey', 'review'),
    streamItem(
      't-5',
      'casa-vieja.jpg',
      'Casa Vieja — Añejo Tequila',
      'error',
      'The connection dropped before this item finished.'
    ),
    streamItem('t-4', 'brand-case-mismatch.png', 'Stone Throw Gin — Small Batch Gin', 'review'),
    streamItem('t-3', 'vintners-red-2021.jpg', 'Vintner Red 2021 — Napa Valley Cabernet', 'fail'),
    streamItem('t-2', "stones-throw-gin.jpg", "Stone's Throw Gin — Small Batch Gin", 'pass'),
    streamItem('t-1', 'old-oak-bourbon.jpg', 'Old Oak Bourbon — Kentucky Straight Bourbon', 'pass')
  ]
};

export const STREAM_TERMINAL_ALL_PASS: StreamSeed = {
  id: 'stream-terminal-all-pass',
  label: 'Terminal — all pass',
  description: 'Every item passed.',
  total: 6,
  doneOverride: 6,
  secondsRemaining: 0,
  items: [
    streamItem('ap-6', 'label-06.jpg', 'Cellar Reserve Riesling — 2022', 'pass'),
    streamItem('ap-5', 'label-05.jpg', 'Highland Scotch — 12 Year', 'pass'),
    streamItem('ap-4', 'label-04.jpg', 'Midnight Rum — Aged 5 Years', 'pass'),
    streamItem('ap-3', 'vintners-red-2021.jpg', 'Vintner Red 2021 — Napa Valley Cabernet', 'pass'),
    streamItem('ap-2', "stones-throw-gin.jpg", "Stone's Throw Gin — Small Batch Gin", 'pass'),
    streamItem('ap-1', 'old-oak-bourbon.jpg', 'Old Oak Bourbon — Kentucky Straight Bourbon', 'pass')
  ]
};

export const STREAM_TERMINAL_ALL_FAIL: StreamSeed = {
  id: 'stream-terminal-all-fail',
  label: 'Terminal — all fail',
  description: 'Every item failed.',
  total: 6,
  doneOverride: 6,
  secondsRemaining: 0,
  items: [
    streamItem('af-6', 'label-06.jpg', 'Cellar Reserve Riesling — 2022', 'fail'),
    streamItem('af-5', 'label-05.jpg', 'Highland Scotch — 12 Year', 'fail'),
    streamItem('af-4', 'label-04.jpg', 'Midnight Rum — Aged 5 Years', 'fail'),
    streamItem('af-3', 'vintners-red-2021.jpg', 'Vintner Red 2021 — Napa Valley Cabernet', 'fail'),
    streamItem('af-2', "stones-throw-gin.jpg", "Stone's Throw Gin — Small Batch Gin", 'fail'),
    streamItem('af-1', 'old-oak-bourbon.jpg', 'Old Oak Bourbon — Kentucky Straight Bourbon', 'fail')
  ]
};

export const STREAM_CANCELLED: StreamSeed = {
  id: 'stream-cancelled',
  label: 'Cancelled mid-run',
  description: 'Three items finished before the reviewer cancelled.',
  total: 12,
  doneOverride: 3,
  secondsRemaining: 0,
  items: [
    streamItem('c-3', 'brand-case-mismatch.png', 'Stone Throw Gin — Small Batch Gin', 'review'),
    streamItem('c-2', "stones-throw-gin.jpg", "Stone's Throw Gin — Small Batch Gin", 'pass'),
    streamItem('c-1', 'old-oak-bourbon.jpg', 'Old Oak Bourbon — Kentucky Straight Bourbon', 'pass')
  ]
};

export const STREAM_SEEDS: StreamSeed[] = [
  STREAM_RUNNING_MIXED,
  STREAM_TERMINAL_MIXED,
  STREAM_TERMINAL_ALL_PASS,
  STREAM_TERMINAL_ALL_FAIL,
  STREAM_CANCELLED
];
