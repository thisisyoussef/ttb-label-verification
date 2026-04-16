import { useEffect, useState } from 'react';

interface WelcomePromptProps {
  onLaunchTour?: () => void;
}

// Key for remembering the collapsed state across page loads. Someone who
// has signed off on the getting-started copy once doesn't need to see it
// at full height on every subsequent visit.
const COLLAPSED_STORAGE_KEY = 'ttb.welcome.collapsed';

function loadInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function WelcomePrompt({ onLaunchTour }: WelcomePromptProps = {}) {
  const [collapsed, setCollapsed] = useState<boolean>(loadInitialCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Private-browsing or quota — remember in-memory only.
    }
  }, [collapsed]);

  return (
    <div className="bg-surface-container-low rounded-lg border border-outline-variant/15 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((previous) => !previous)}
        aria-expanded={!collapsed}
        aria-controls="welcome-prompt-body"
        className="w-full flex items-center gap-2 p-4 md:p-5 text-left hover:bg-surface-container/60 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] min-h-[56px]"
      >
        <span
          className="material-symbols-outlined text-[20px] text-primary"
          aria-hidden="true"
        >
          lightbulb
        </span>
        <h2 className="font-headline text-lg font-bold text-on-surface flex-1">
          Getting started
        </h2>
        <span
          aria-hidden="true"
          className={[
            'material-symbols-outlined text-on-surface-variant text-[22px] transition-transform duration-200 motion-reduce:transition-none',
            collapsed ? '' : 'rotate-180'
          ].join(' ')}
        >
          expand_more
        </span>
      </button>
      {!collapsed ? (
        <div
          id="welcome-prompt-body"
          className="px-6 pb-5 flex flex-col gap-4"
        >
          <ol className="flex flex-col gap-2 font-body text-sm text-on-surface-variant list-decimal list-inside">
            <li>Drop or browse for a label image.</li>
            <li>
              Fill in the declared values from the COLA application
              <span className="text-on-surface-variant/60"> (or paste JSON)</span>.
            </li>
            <li>Click <strong className="text-on-surface font-semibold">Verify Label</strong>.</li>
          </ol>
          <p className="text-sm text-on-surface-variant font-label">
            You can also upload just the image to check it without application data.
          </p>
          {onLaunchTour ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={onLaunchTour}
                className="inline-flex items-center gap-1 py-3 text-sm font-label font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              >
                Not sure where to start? Take a 60-second tour
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
