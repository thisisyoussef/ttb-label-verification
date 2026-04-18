import type {
  BeverageSelection,
  ProcessingPhase,
  ProcessingStep,
  UIVerificationReport
} from './types';

export type ReviewPipelineEvent =
  | {
      type: 'review.submit.started';
      traceId: string;
      requestId: number;
      scenarioId: string;
      demoScenarioId: string | null;
      labelMimeType: string;
      labelBytes: number;
      hasApplicationData: boolean;
      beverage: BeverageSelection;
    }
  | {
      type: 'review.submit.fixture-failure';
      traceId: string;
      requestId: number;
      scenarioId: string;
    }
  | {
      type: 'review.submit.response-ok';
      traceId: string;
      requestId: number;
      scenarioId: string;
      reportId: string;
      verdict: UIVerificationReport['verdict'];
      standalone: boolean;
      extractionState: UIVerificationReport['extractionQuality']['state'];
    }
  | {
      type: 'review.submit.response-error';
      traceId: string;
      requestId: number;
      scenarioId: string;
      message: string;
    }
  | {
      type: 'review.submit.aborted';
      traceId: string;
      requestId: number;
      scenarioId: string;
    }
  | {
      type: 'review.submit.exception';
      traceId: string;
      requestId: number;
      scenarioId: string;
      errorName: string;
      message: string;
    }
  | {
      type: 'review.pipeline.complete';
      traceId: string | null;
      requestId: number;
      scenarioId: string;
      hasLiveReport: boolean;
      resultReportId: string | null;
      resultVerdict: UIVerificationReport['verdict'] | null;
    }
  | {
      type: 'review.pipeline.failed';
      traceId: string | null;
      requestId: number;
      scenarioId: string;
      phase: ProcessingPhase;
      message: string;
    }
  | {
      type: 'review.pipeline.state';
      traceId: string | null;
      scenarioId: string;
      phase: ProcessingPhase;
      activeStepId: ProcessingStep['id'] | null;
      failedStepId: ProcessingStep['id'] | null;
      stepStatuses: Array<{
        id: ProcessingStep['id'];
        status: ProcessingStep['status'];
      }>;
    };
