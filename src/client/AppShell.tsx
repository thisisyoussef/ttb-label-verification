import { useCallback, useEffect, useRef } from 'react';
import { BackBreadcrumb } from './BackBreadcrumb';
import { BatchDashboard } from './BatchDashboard';
import { BatchDrillInShell } from './BatchDrillInShell';
import { BatchProcessing } from './BatchProcessing';
import { BatchUpload } from './BatchUpload';
import { GuidedTourSpotlight } from './GuidedTourSpotlight';
import { HelpLauncher } from './HelpLauncher';
import { ImagePreviewOverlay } from './ImagePreviewOverlay';
import { Intake } from './Intake';
import { Processing } from './Processing';
import { Results } from './Results';
import { SessionTimeoutModal } from './SessionTimeoutModal';
import { SignedInIdentity } from './SignedInIdentity';
import { type HelpShowMe } from './helpManifest';
import type { ExtractionMode, Mode, View } from './appTypes';
import type { BatchWorkflow } from './useBatchWorkflow';
import type { HelpTourFlow } from './useHelpTourState';
import type { SingleReviewFlow } from './useSingleReviewFlow';

interface AppShellProps {
  mode: Mode;
  view: View;
  single: SingleReviewFlow;
  batch: BatchWorkflow;
  help: HelpTourFlow;
  extractionMode: ExtractionMode;
  extractionModeDisabled: boolean;
  sessionTimeoutOpen: boolean;
  sessionTimeoutRemainingSeconds: number;
  tourExpandedCheckId?: string | null;
  tourNextDisabled?: boolean;
  onSelectMode: (next: Mode) => void;
  onExtractionModeChange: (mode: ExtractionMode) => void;
  onSignOut: () => void;
  onStaySignedIn: () => void;
  onTourNext: () => void;
  onTourAdvanceInteraction: () => void;
  onTourFinish: () => void;
  onTourShowMe: (action: HelpShowMe) => void;
  onTourShowMeAndContinue: (action: HelpShowMe) => void;
}

export function AppShell({
  mode,
  view,
  single,
  batch,
  help,
  extractionMode,
  extractionModeDisabled: _extractionModeDisabled,
  sessionTimeoutOpen,
  sessionTimeoutRemainingSeconds,
  tourExpandedCheckId = null,
  tourNextDisabled = false,
  onSelectMode,
  onExtractionModeChange,
  onSignOut,
  onStaySignedIn,
  onTourNext,
  onTourAdvanceInteraction,
  onTourFinish,
  onTourShowMe,
  onTourShowMeAndContinue
}: AppShellProps) {
  const headerRef = useRef<HTMLElement>(null);

  const syncHeaderHeight = useCallback(() => {
    const el = headerRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--header-h', `${h}px`);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    syncHeaderHeight();
    const ro = new ResizeObserver(syncHeaderHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncHeaderHeight]);

  return (
    <div className="min-h-full flex flex-col bg-background">
      <SessionTimeoutModal
        open={sessionTimeoutOpen}
        remainingSeconds={sessionTimeoutRemainingSeconds}
        onStaySignedIn={onStaySignedIn}
        onSignOut={onSignOut}
      />
      <header ref={headerRef} className="bg-surface-container-low border-b border-outline-variant/15 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto w-full px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="font-headline text-lg font-bold tracking-tight text-on-surface">
                TTB Label Verification Assistant
              </span>
              <span className="text-xs font-label uppercase tracking-widest text-on-surface-variant">
                AI-assisted compliance checking
              </span>
            </div>
            <nav
              aria-label="Review mode"
              role="tablist"
              className="hidden md:flex items-center gap-2"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'single'}
                onClick={() => onSelectMode('single')}
                className={[
                  'px-4 py-3 text-sm min-h-[44px] transition-colors',
                  mode === 'single'
                    ? 'font-semibold text-on-surface border-b-2 border-primary'
                    : 'font-medium text-on-surface-variant hover:text-on-surface'
                ].join(' ')}
              >
                Single
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'batch'}
                data-tour-target="tour-batch-tab"
                onClick={() => onSelectMode('batch')}
                className={[
                  'px-4 py-3 text-sm min-h-[44px] transition-colors',
                  mode === 'batch'
                    ? 'font-semibold text-on-surface border-b-2 border-primary'
                    : 'font-medium text-on-surface-variant hover:text-on-surface'
                ].join(' ')}
              >
                Batch
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {/*
              Cloud/Local toggle removed from the header per UX decision: Dave
              and Sarah don't need to choose where inference runs. The override
              is available to developers via the Toolbench ("Provider Override")
              so demos can still force a specific mode. The selected mode is
              still threaded into downstream components (Processing, Results)
              so existing failure/retry flows keep working.
            */}
            <HelpLauncher
              active={help.tourOpen}
              showNudge={!help.helpNudgeDismissed && !help.tourOpen}
              onLaunch={help.onLaunchTour}
              onDismissNudge={help.onDismissNudge}
            />
            <SignedInIdentity onSignOut={onSignOut} />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {view === 'intake' ? (
          <Intake
            image={single.image}
            secondaryImage={single.secondaryImage}
            beverage={single.beverage}
            fields={single.fields}
            onImagesChange={single.onImagesChange}
            onBeverageChange={single.setBeverage}
            onFieldsChange={single.setFields}
            onVerify={single.onVerify}
            onClear={single.onClear}
            onLaunchTour={help.onLaunchTour}
          />
        ) : view === 'processing' && single.image ? (
          <Processing
            image={single.image}
            secondaryImage={single.secondaryImage}
            beverage={single.beverage}
            steps={single.steps}
            phase={single.phase}
            failureMessage={single.failureMessage}
            localUnavailable={extractionMode === 'local' && single.phase === 'failed'}
            ocrPreview={single.ocrPreview}
            onCancel={single.onCancel}
            onRetry={single.onRetry}
            onBackToIntake={single.onBackToIntake}
            onSwitchToCloud={() => {
              onExtractionModeChange('cloud');
              single.onRetry();
            }}
          />
        ) : view === 'results' && single.image && single.report ? (
          <>
            <BackBreadcrumb
              onBack={single.onNewReview}
              label="Start a new check"
              ariaLabel="Start a new check"
            />
            <Results
              image={single.image}
              secondaryImage={single.secondaryImage}
              beverage={single.beverage}
              report={single.report}
              tourExpandedCheckId={tourExpandedCheckId}
              refineStatus={single.refineStatus}
              onNewReview={single.onNewReview}
              onRunFullComparison={single.onRunFullComparison}
              onTryAnotherImage={single.onTryAnotherImage}
              onContinueWithCaution={single.onContinueWithCaution}
              onExportResults={single.onExportResults}
              exportEnabled={true}
            />
          </>
        ) : view === 'batch-intake' ? (
          <BatchUpload
            seed={batch.batchSeed}
            interactive={true}
            onReturnToSingle={batch.onReturnToSingle}
            onStartBatch={batch.onStartBatchFromIntake}
            onSelectImages={batch.onSelectLiveImages}
            onRemoveImage={batch.onRemoveLiveImage}
            onSelectCsv={batch.onSelectLiveCsv}
            onPickAmbiguous={batch.onPickAmbiguous}
            onDropAmbiguous={batch.onDropAmbiguous}
            onPairUnmatchedImage={batch.onPairUnmatchedImage}
            onDropUnmatchedImage={batch.onDropUnmatchedImage}
            onPairUnmatchedRow={batch.onPairUnmatchedRow}
            onDropUnmatchedRow={batch.onDropUnmatchedRow}
            onPreviewImage={batch.onPreviewImage}
          />
        ) : view === 'batch-processing' ? (
          <BatchProcessing
            phase={batch.batchPhase}
            progress={batch.batchProgress}
            items={batch.batchItems}
            summary={batch.summary}
            onCancel={batch.onCancelBatchRun}
            onRetryItem={batch.onRetryBatchItem}
            onBackToIntake={batch.onBatchBackToIntake}
            onOpenDashboard={batch.onBatchOpenDashboard}
            onPreviewItem={batch.onPreviewStreamItem}
          />
        ) : view === 'batch-dashboard' ? (
          <BatchDashboard
            seed={batch.dashboardSeed}
            reviewedIds={batch.reviewedRowIds}
            exportState={batch.exportState}
            onOpenRow={batch.onOpenDashboardRow}
            onRetryRow={batch.onRetryDashboardRow}
            onStartAnotherBatch={batch.onStartAnotherBatch}
            onBeginExport={batch.onBeginExport}
            onConfirmExport={batch.onConfirmExport}
            onCancelExport={batch.onCancelExport}
            onRetryExport={batch.onRetryExport}
          />
        ) : view === 'batch-result' && batch.drillInRowId ? (
          (() => {
            const currentRow = batch.drillInRows.find(
              (row) => row.rowId === batch.drillInRowId
            );
            if (!currentRow) {
              return null;
            }
            const index = batch.drillInRows.findIndex(
              (row) => row.rowId === batch.drillInRowId
            );
            return (
              <BatchDrillInShell
                row={currentRow}
                report={batch.drillInReport}
                indexInView={index + 1}
                totalInView={batch.drillInRows.length}
                filter={batch.drillInFilter}
                hasPrevious={index > 0}
                hasNext={index < batch.drillInRows.length - 1}
                onBack={batch.onDashboardBack}
                onPrevious={batch.onDrillInPrevious}
                onNext={batch.onDrillInNext}
                onExportResults={batch.onBeginExport}
              />
            );
          })()
        ) : null}
      </main>

      <ImagePreviewOverlay image={batch.previewImage} onClose={batch.onClosePreview} />
      {help.tourOpen ? (
        <GuidedTourSpotlight
          steps={help.tourSteps}
          currentIndex={help.tourStepIndex}
          onClose={help.onCloseTour}
          onPrevious={help.onPreviousTourStep}
          onNext={onTourNext}
          nextDisabled={tourNextDisabled}
          onAdvanceInteraction={onTourAdvanceInteraction}
          onFinish={onTourFinish}
          onShowMe={onTourShowMe}
          onShowMeAndContinue={onTourShowMeAndContinue}
        />
      ) : null}
    </div>
  );
}
