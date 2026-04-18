import type {
  BatchPhase,
  BatchProgress,
  BatchStreamItem,
  BatchTerminalSummary
} from './batchTypes';
import {
  Banner,
  CancelledActions,
  Header,
  PrivacyFoot,
  ProgressBlock,
  StreamBlock,
  TerminalSummary
} from './BatchProcessingSections';

interface BatchProcessingProps {
  phase: BatchPhase;
  progress: BatchProgress;
  items: BatchStreamItem[];
  summary: BatchTerminalSummary | null;
  onCancel: () => void;
  onRetryItem: (itemId: string) => void;
  onBackToIntake: () => void;
  onOpenDashboard: () => void;
  onPreviewItem: (item: BatchStreamItem) => void;
}

export function BatchProcessing(props: BatchProcessingProps) {
  const { phase, progress, items, summary } = props;
  const isRunning = phase === 'running';
  const isCancelled = phase === 'cancelled';
  const isTerminal = phase === 'terminal';
  const remaining = Math.max(progress.total - progress.done, 0);
  const percent =
    progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <div className="max-w-[1400px] mx-auto w-full px-6 py-6 xl:py-10">
      <div className="flex flex-col gap-8">
        <Header
          phase={phase}
          total={progress.total}
          summary={summary}
        />

        {isCancelled ? (
          <Banner
            tone="neutral"
            icon="info"
            heading="Batch cancelled. Completed items shown below."
            body="Nothing is stored. Return to intake to start over."
          />
        ) : null}

        {isTerminal && summary ? (
          <TerminalSummary
            summary={summary}
            onBackToIntake={props.onBackToIntake}
            onOpenDashboard={props.onOpenDashboard}
          />
        ) : null}

        {isRunning ? (
          <ProgressBlock
            done={progress.done}
            total={progress.total}
            remaining={remaining}
            secondsRemaining={progress.secondsRemaining}
            percent={percent}
            onCancel={props.onCancel}
          />
        ) : null}

        <StreamBlock
          items={items}
          onRetryItem={props.onRetryItem}
          onPreviewItem={props.onPreviewItem}
          streamEmptyLabel={
            isRunning
              ? 'Processing has started. Completed items appear here.'
              : 'No items completed before the batch ended.'
          }
        />

        {isRunning ? (
          <PrivacyFoot />
        ) : isCancelled ? (
          <CancelledActions onBackToIntake={props.onBackToIntake} />
        ) : null}
      </div>
    </div>
  );
}
