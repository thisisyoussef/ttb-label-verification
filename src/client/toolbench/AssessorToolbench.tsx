import { useEffect, useRef } from 'react';
import type { ExtractionMode, Mode } from '../appTypes';
import { ToolbenchActions } from './ToolbenchActions';
import { ToolbenchAssets } from './ToolbenchAssets';
import { ToolbenchSamples, type SampleFields } from './ToolbenchSamples';
import { type ToolbenchTab, useToolbenchState } from './useToolbenchState';

interface AssessorToolbenchProps {
  onLoadSample: (files: File[], fields: SampleFields, imageId: string) => void;
  onLoadBatch: (images: File[], csv: File) => void;
  onLoadImage: (file: File) => void;
  onLoadCsv: (file: File) => void;
  mode: Mode;
  extractionMode: ExtractionMode;
  onReset: () => void;
  onSwitchMode: (next: Mode) => void;
  onToggleExtraction: (next: ExtractionMode) => void;
  onLaunchTour: () => void;
  tourActive: boolean;
}

const TABS: { id: ToolbenchTab; label: string }[] = [
  { id: 'samples', label: 'Samples' },
  { id: 'assets', label: 'Upload' },
  { id: 'actions', label: 'Actions' },
];

export function AssessorToolbench({
  onLoadSample,
  onLoadBatch,
  onLoadImage,
  onLoadCsv,
  extractionMode,
  onReset,
  onSwitchMode,
  onToggleExtraction,
  onLaunchTour,
  tourActive
}: AssessorToolbenchProps) {
  const { open, tab, setTab, toggle, close, hasOpenedOnce } = useToolbenchState();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelOpen = open && !tourActive;
  const showNudge = !panelOpen && !hasOpenedOnce && !tourActive;

  // Escape to close
  useEffect(() => {
    if (!panelOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [panelOpen, close]);

  useEffect(() => {
    if (!tourActive || !open) return;
    close();
  }, [close, open, tourActive]);

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {/* Panel — renders above FAB in flex-col so it grows upward */}
      {panelOpen && (
        <div className="flex h-[min(520px,calc(100vh-96px))] w-[400px] min-h-0 flex-col overflow-hidden rounded-xl border border-dashed border-outline-variant/60 bg-surface-container shadow-ambient">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant/40 shrink-0">
            <span className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-widest">
              Assessor Toolbench
            </span>
            <button
              onClick={close}
              aria-label="Close toolbench"
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Tab bar */}
          <div role="tablist" className="flex border-b border-outline-variant/40 shrink-0">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex-1 py-2 text-xs font-label font-semibold transition-colors border-b-2 ${
                  tab === id
                    ? 'text-primary border-primary'
                    : 'text-on-surface-variant border-transparent hover:text-on-surface'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div role="tabpanel" className="flex-1 min-h-0 overflow-y-auto">
            {tab === 'samples' && (
              <ToolbenchSamples
                onLoadSample={(files, fields, imageId) => {
                  onLoadSample(files, fields, imageId);
                  close();
                }}
                onLoadBatch={(images, csv) => {
                  onLoadBatch(images, csv);
                  close();
                }}
                // Synthetic-label flow keeps the toolbench open so the
                // expected-verdict chip stays visible — devs read it
                // before clicking Verify to compare actual vs expected.
                onLoadSyntheticSample={(files, fields, imageId) => {
                  onLoadSample(files, fields, imageId);
                }}
              />
            )}
            {tab === 'assets' && (
              <ToolbenchAssets onLoadImage={onLoadImage} onLoadCsv={onLoadCsv} />
            )}
            {tab === 'actions' && (
              <ToolbenchActions
                extractionMode={extractionMode}
                onReset={onReset}
                // Close the toolbench drawer as part of "Open <mode>
                // review" so the user actually SEES the navigation land.
                // Without this, the toolbench stays open over the new
                // page and the click looks like it didn't do anything.
                onOpenMode={(next) => {
                  onSwitchMode(next);
                  close();
                }}
                onToggleExtraction={onToggleExtraction}
                onLaunchTour={onLaunchTour}
              />
            )}
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={toggle}
        aria-expanded={panelOpen}
        aria-label={showNudge ? 'Open assessor toolbench (new)' : 'Toggle assessor toolbench'}
        disabled={tourActive}
        title={tourActive ? 'Close the guided tour to reopen the toolbench.' : undefined}
        className={`relative flex items-center gap-1.5 rounded-full px-4 py-2 border border-dashed font-label text-xs font-semibold transition-colors ${
          panelOpen
            ? 'border-primary/50 bg-primary/10 text-primary'
            : tourActive
              ? 'border-outline-variant/40 bg-surface-container-low text-outline-variant/80 cursor-not-allowed'
              : showNudge
                ? 'border-primary/60 bg-primary/10 text-primary shadow-ambient'
                : 'border-outline-variant/60 bg-surface-container text-on-surface-variant hover:border-primary/40 hover:text-primary'
        }`}
      >
        {showNudge && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-1 -right-1 flex h-2.5 w-2.5"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        )}
        <span className="material-symbols-outlined text-[16px]">science</span>
        Toolbench
      </button>
    </div>
  );
}
