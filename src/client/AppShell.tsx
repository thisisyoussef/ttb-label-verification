import { BackBreadcrumb } from './BackBreadcrumb';
import { BatchDashboard } from './BatchDashboard';
import { BatchDrillInShell } from './BatchDrillInShell';
import { BatchProcessing } from './BatchProcessing';
import { BatchUpload } from './BatchUpload';
import { DASHBOARD_SEEDS } from './batchDashboardScenarios';
import { SEED_BATCHES, STREAM_SEEDS } from './batchScenarios';
import { GuidedTourSpotlight } from './GuidedTourSpotlight';
import { HelpLauncher } from './HelpLauncher';
import { ImagePreviewOverlay } from './ImagePreviewOverlay';
import { Intake } from './Intake';
import { Processing } from './Processing';
import { Results } from './Results';
import { ScenarioPicker } from './ScenarioPicker';
import { SessionTimeoutModal } from './SessionTimeoutModal';
import { SignedInIdentity } from './SignedInIdentity';
import { type HelpShowMe } from './helpManifest';
import type { Mode, View } from './appTypes';
import type { BatchWorkflow } from './useBatchWorkflow';
import type { HelpTourFlow } from './useHelpTourState';
import type { SingleReviewFlow } from './useSingleReviewFlow';

interface AppShellProps {
  mode: Mode;
  view: View;
  fixtureControlsEnabled: boolean;
  single: SingleReviewFlow;
  batch: BatchWorkflow;
  help: HelpTourFlow;
  sessionTimeoutOpen: boolean;
  sessionTimeoutRemainingSeconds: number;
  tourExpandedCheckId?: string | null;
  tourNextDisabled?: boolean;
  onSelectMode: (next: Mode) => void;
  onSignOut: () => void;
  onStaySignedIn: () => void;
  onTourNext: () => void;
  onTourAdvanceInteraction: () => void;
  onTourFinish: () => void;
  onTourShowMe: (action: HelpShowMe) => void;
}

export function AppShell({
  mode,
  view,
  fixtureControlsEnabled,
  single,
  batch,
  help,
  sessionTimeoutOpen,
  sessionTimeoutRemainingSeconds,
  tourExpandedCheckId = null,
  tourNextDisabled = false,
  onSelectMode,
  onSignOut,
  onStaySignedIn,
  onTourNext,
  onTourAdvanceInteraction,
  onTourFinish,
  onTourShowMe
}: AppShellProps) {
  return (
    <div className="min-h-full flex flex-col bg-background">
      <SessionTimeoutModal
        open={sessionTimeoutOpen}
        remainingSeconds={sessionTimeoutRemainingSeconds}
        onStaySignedIn={onStaySignedIn}
        onSignOut={onSignOut}
      />
      <header className="bg-surface-container-low border-b border-outline-variant/15 sticky top-0 z-40">
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
                  'px-4 py-2 text-sm transition-colors',
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
                  'px-4 py-2 text-sm transition-colors',
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
            {mode === 'single' ? (
              fixtureControlsEnabled ? (
                <>
                  <ScenarioPicker
                    scenarioId={single.scenarioId}
                    onSelect={single.onSelectScenario}
                  />
                  <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
                    <span className="uppercase tracking-widest font-bold">Result variant</span>
                    <select
                      value={single.variantOverride}
                      onChange={(event) =>
                        single.setVariantOverride(event.target.value as typeof single.variantOverride)
                      }
                      className="bg-surface-container-lowest border border-outline-variant/40 rounded px-2 py-1 text-xs font-body font-semibold text-on-surface focus:ring-primary/40"
                    >
                      {single.variantOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={single.forceFailure}
                      onChange={(event) => single.setForceFailure(event.target.checked)}
                      className="rounded text-primary focus:ring-primary/40"
                    />
                    <span className="uppercase tracking-widest font-bold">Force failure</span>
                  </label>
                </>
              ) : null
            ) : fixtureControlsEnabled ? (
              <>
                <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
                  <span className="uppercase tracking-widest font-bold">Batch scenario</span>
                  <select
                    value={batch.batchSeedId}
                    onChange={(event) => batch.onSelectBatchSeed(event.target.value)}
                    className="bg-surface-container-lowest border border-outline-variant/40 rounded px-2 py-1 text-xs font-body font-semibold text-on-surface focus:ring-primary/40"
                  >
                    {SEED_BATCHES.map((seed) => (
                      <option key={seed.id} value={seed.id}>
                        {seed.label}
                      </option>
                    ))}
                  </select>
                </label>
                {view === 'batch-processing' ? (
                  <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
                    <span className="uppercase tracking-widest font-bold">Stream variant</span>
                    <select
                      value={batch.batchStreamSeedId}
                      onChange={(event) => batch.onSelectStreamSeed(event.target.value)}
                      className="bg-surface-container-lowest border border-outline-variant/40 rounded px-2 py-1 text-xs font-body font-semibold text-on-surface focus:ring-primary/40"
                    >
                      {STREAM_SEEDS.map((seed) => (
                        <option key={seed.id} value={seed.id}>
                          {seed.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {view === 'batch-dashboard' || view === 'batch-result' ? (
                  <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
                    <span className="uppercase tracking-widest font-bold">Dashboard seed</span>
                    <select
                      value={batch.dashboardSeedId}
                      onChange={(event) => batch.onSelectDashboardSeed(event.target.value)}
                      className="bg-surface-container-lowest border border-outline-variant/40 rounded px-2 py-1 text-xs font-body font-semibold text-on-surface focus:ring-primary/40"
                    >
                      {DASHBOARD_SEEDS.map((seed) => (
                        <option key={seed.id} value={seed.id}>
                          {seed.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </>
            ) : null}
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
            beverage={single.beverage}
            fields={single.fields}
            onImageChange={single.onImageChange}
            onBeverageChange={single.setBeverage}
            onFieldsChange={single.setFields}
            onVerify={single.onVerify}
            onClear={single.onClear}
          />
        ) : view === 'processing' && single.image ? (
          <Processing
            image={single.image}
            beverage={single.beverage}
            steps={single.steps}
            phase={single.phase}
            failureMessage={single.failureMessage}
            onCancel={single.onCancel}
            onRetry={single.onRetry}
            onBackToIntake={single.onBackToIntake}
          />
        ) : view === 'results' && single.image && single.report ? (
          <>
            <BackBreadcrumb
              onBack={single.onNewReview}
              label="Back to Intake"
              ariaLabel="Back to intake"
            />
            <Results
              image={single.image}
              beverage={single.beverage}
              report={single.report}
              tourExpandedCheckId={tourExpandedCheckId}
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
            interactive={!fixtureControlsEnabled}
            onReturnToSingle={batch.onReturnToSingle}
            onStartBatch={batch.onStartBatchFromIntake}
            onSelectImages={!fixtureControlsEnabled ? batch.onSelectLiveImages : undefined}
            onSelectCsv={!fixtureControlsEnabled ? batch.onSelectLiveCsv : undefined}
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
        />
      ) : null}
    </div>
  );
}
