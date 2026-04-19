import type { BatchItemStatus } from './batchTypes';

export interface BatchStatusDisplay {
  label: string;
  icon: string;
  className: string;
}

export function resolveBatchStatusDisplay(
  status: BatchItemStatus
): BatchStatusDisplay {
  switch (status) {
    case 'pass':
      return {
        label: 'Pass',
        icon: 'check_circle',
        className: 'bg-tertiary-container/40 text-on-tertiary-container'
      };
    case 'error':
      return {
        label: 'Error',
        icon: 'error',
        className: 'bg-surface-container-highest text-on-surface-variant'
      };
    case 'review':
    case 'fail':
      return {
        label: 'Needs review',
        icon: 'visibility',
        className: 'bg-caution-container text-on-caution-container'
      };
  }
}

export function countBatchNeedsReview(input: {
  review: number;
  fail: number;
}) {
  return input.review + input.fail;
}
