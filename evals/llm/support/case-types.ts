import type {
  CheckStatus,
  ExtractionQualityState,
  VerificationReport
} from '../../../src/shared/contracts/review';
import {
  buildReviewFormFields,
  type RawReviewModelOutput
} from '../../../src/server/testing/llm-fixture-builders';

export type Persona = 'Sarah' | 'Dave' | 'Jenny' | 'Marcus' | 'Janet';

export type CommonCase = {
  caseId: string;
  title: string;
  labelFilename: string;
  byteSignature: string;
  personas: Persona[];
  personaObservation: string;
};

export type ReviewEndpointCase = CommonCase & {
  fields: ReturnType<typeof buildReviewFormFields> | null;
  modelOutput: RawReviewModelOutput;
  expected: {
    verdict: VerificationReport['verdict'];
    summaryIncludes: string;
    reviewCheckIds?: string[];
    failCheckIds?: string[];
    standalone?: boolean;
    extractionState?: ExtractionQualityState;
  };
};

export type ExtractionEndpointCase = CommonCase & {
  fields: ReturnType<typeof buildReviewFormFields> | null;
  modelOutput: RawReviewModelOutput;
  expected: {
    beverageType: 'distilled-spirits' | 'wine' | 'malt-beverage' | 'unknown';
    beverageTypeSource: 'application' | 'class-type' | 'model-hint' | 'strict-fallback';
    standalone: boolean;
    hasApplicationData: boolean;
    imageQualityState: ExtractionQualityState;
    presentFieldIds: string[];
  };
};

export type WarningEndpointCase = CommonCase & {
  fields: ReturnType<typeof buildReviewFormFields> | null;
  modelOutput: RawReviewModelOutput;
  expected: {
    status: CheckStatus;
    subChecks: Partial<Record<
      'present' | 'exact-text' | 'uppercase-bold-heading' | 'continuous-paragraph' | 'legibility',
      CheckStatus
    >>;
  };
};

export type BatchEndpointCase = CommonCase & {
  batchRow: ReturnType<typeof buildReviewFormFields>;
  steps: Array<
    | {
        type: 'output';
        output: RawReviewModelOutput;
      }
    | {
        type: 'error';
      }
  >;
  expected: {
    runStatus: 'pass' | 'review' | 'fail' | 'error';
    retryStatus?: 'pass' | 'review' | 'fail' | 'error';
    summaryAfterRun: {
      pass: number;
      review: number;
      fail: number;
      error: number;
    };
    summaryAfterRetry?: {
      pass: number;
      review: number;
      fail: number;
      error: number;
    };
  };
};
