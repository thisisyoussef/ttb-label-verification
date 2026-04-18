import { useEffect, useRef } from 'react';
import type { ExtractionMode, Mode } from '../appTypes';
import { ToolbenchActions } from './ToolbenchActions';
import { ToolbenchAssets } from './ToolbenchAssets';
import { ToolbenchSamples, type SampleFields } from './ToolbenchSamples';
import { type ToolbenchTab, useToolbenchState } from './useToolbenchState';

interface AssessorToolbenchProps {
  onLoadSample: (file: File, fields: SampleFields, imageId: string) => void;
  onLoadBatch: (images: File[], csv: File) => void;
  onLoadImage: (file: File) => void;
  onLoadCsv: (file: File) => void;
  mode: Mode;
  extractionMode: ExtractionMode;
  onReset: () => void;
  onSwitchMode: (next: Mode) => void;
  onToggleExtraction: (next: ExtractionMode) => void;
  onLaunchTour: () => void;
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
}: AssessorToolbenchProps) {
  const { open, tab, setTab, toggle, close } = useToolbenchState();
  const containerRef = useRef<HTMLDivElement>(null);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, close]);

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {/* Panel — renders above FAB in flex-col so it grows upward */}
      {open && (
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
                onLoadSample={(file, fields, imageId) => {
                  onLoadSample(file, fields, imageId);
                  close();
                }}
                onLoadBatch={(images, csv) => {
                  onLoadBatch(images, csv);
                  close();
                }}
                // Synthetic-label flow keeps the toolbench open so the
                // expected-verdict chip stays visible — devs read it
                // before clicking Verify to compare actual vs expected.
                onLoadSyntheticSample={(file, fields, imageId) => {
                  onLoadSample(file, fields, imageId);
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
        aria-expanded={open}
        aria-label="Toggle assessor toolbench"
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 border border-dashed font-label text-xs font-semibold transition-colors ${
          open
            ? 'border-primary/50 bg-primary/10 text-primary'
            : 'border-outline-variant/60 bg-surface-container text-on-surface-variant hover:border-primary/40 hover:text-primary'
        }`}
      >
        <span className="material-symbols-outlined text-[16px]">science</span>
        Toolbench
      </button>
    </div>
  );
}
