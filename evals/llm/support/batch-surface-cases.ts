import {
  buildRawReviewModelOutput,
  buildReviewFormFields,
  presentModelField
} from '../../../src/server/testing/llm-fixture-builders';
import {
  assertGoldenCasesExist,
  goldenCaseTitle,
  goldenSliceCaseIds
} from './golden-manifest';
import type { BatchEndpointCase } from './case-types';

function title(caseId: string) {
  return goldenCaseTitle(caseId);
}

export const batchEndpointCases: BatchEndpointCase[] = [
  {
    caseId: 'G-34',
    title: title('G-34'),
    labelFilename: 'batch-pass.png',
    byteSignature: '34',
    personas: ['Janet', 'Marcus'],
    personaObservation:
      'Batch run should keep a clean happy-path item stable and privacy-safe.',
    batchRow: buildReviewFormFields({
      brandName: 'Batch Estate',
      classType: 'Red Wine',
      alcoholContent: '13.5% Alc./Vol.',
      netContents: '750 mL'
    }),
    steps: [
      {
        type: 'output',
        output: buildRawReviewModelOutput({
          beverageTypeHint: 'wine',
          fields: {
            brandName: presentModelField('Batch Estate'),
            classType: presentModelField('Red Wine'),
            alcoholContent: presentModelField('13.5% Alc./Vol.'),
            netContents: presentModelField('750 mL')
          }
        })
      }
    ],
    expected: {
      runStatus: 'pass',
      summaryAfterRun: { pass: 1, review: 0, fail: 0, error: 0 }
    }
  },
  {
    caseId: 'G-35',
    title: title('G-35'),
    labelFilename: 'batch-review.png',
    byteSignature: '35',
    personas: ['Janet', 'Dave', 'Marcus'],
    personaObservation:
      'Batch review items should stay isolated and avoid becoming false fails.',
    batchRow: buildReviewFormFields({
      brandName: 'Batch Review',
      classType: 'Vodka',
      alcoholContent: '45% Alc./Vol.',
      netContents: '750 mL'
    }),
    steps: [
      {
        type: 'output',
        output: buildRawReviewModelOutput({
          fields: {
            brandName: presentModelField('BATCH REVIEW')
          }
        })
      }
    ],
    expected: {
      // Brand case-only difference ("Batch Review" vs "BATCH REVIEW") now
      // auto-approves via the brand-name judgment rule. The test's intent
      // (batch items stay isolated and don't false-fail) still holds.
      runStatus: 'pass',
      summaryAfterRun: { pass: 1, review: 0, fail: 0, error: 0 }
    }
  },
  {
    caseId: 'G-36',
    title: title('G-36'),
    labelFilename: 'batch-retry.png',
    byteSignature: '36',
    personas: ['Janet', 'Marcus'],
    personaObservation:
      'Retry should contain the failure to one row and recover cleanly on the second attempt.',
    batchRow: buildReviewFormFields({
      brandName: 'Batch Retry',
      classType: 'Red Wine',
      alcoholContent: '13.8% Alc./Vol.',
      netContents: '750 mL'
    }),
    steps: [
      {
        type: 'error'
      },
      {
        type: 'output',
        output: buildRawReviewModelOutput({
          beverageTypeHint: 'wine',
          fields: {
            brandName: presentModelField('Batch Retry'),
            classType: presentModelField('Red Wine'),
            alcoholContent: presentModelField('13.8% Alc./Vol.'),
            netContents: presentModelField('750 mL')
          }
        })
      }
    ],
    expected: {
      runStatus: 'error',
      retryStatus: 'pass',
      summaryAfterRun: { pass: 0, review: 0, fail: 0, error: 1 },
      summaryAfterRetry: { pass: 1, review: 0, fail: 0, error: 0 }
    }
  }
];

assertGoldenCasesExist(batchEndpointCases.map((entry) => entry.caseId));
goldenSliceCaseIds('endpoint-batch');
