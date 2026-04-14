import type { BatchStreamItem } from './batchTypes';
import { buildLabelThumbnail } from './labelThumbnail';

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

  if (errorMessage !== undefined) {
    base.errorMessage = errorMessage;
  }

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
