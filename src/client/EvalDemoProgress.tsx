import type { EvalPack, EvalPackImage } from './evalDemoApi';
import { imageUrlFor } from './evalDemoApi';
import type { EvalRunState } from './evalDemoTypes';

interface EvalDemoProgressProps {
  state: EvalRunState;
  pack: EvalPack | null;
}

function formatSeconds(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function formatElapsed(state: EvalRunState, now: number): string {
  if (!state.startedAtMs) return '—';
  const end = state.endedAtMs ?? now;
  const ms = Math.max(0, end - state.startedAtMs);
  return formatSeconds(Math.round(ms / 1000));
}

export function EvalDemoProgress(props: EvalDemoProgressProps) {
  const { state, pack } = props;
  const now = Date.now();
  const percent = state.total === 0 ? 0 : Math.min(100, Math.round((state.done / state.total) * 100));

  // Current image: next pending pack image.
  const currentImage = findCurrentImage({
    pack,
    completedImageIds: new Set(state.items.map((item) => item.imageId))
  });

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-ambient">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-headline text-lg text-on-surface">Live progress</h2>
          <p className="text-sm text-on-surface-variant">
            Streaming NDJSON from <code className="font-mono text-xs">/api/batch/run</code>
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <MetricChip label="Elapsed" value={formatElapsed(state, now)} />
          <MetricChip label="ETA" value={formatSeconds(state.secondsRemaining)} />
          <MetricChip
            label="Done"
            value={`${state.done} / ${state.total || '?'}`}
          />
        </div>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CountTile label="Pass" count={state.counts.pass} tone="pass" />
        <CountTile label="Review" count={state.counts.review} tone="review" />
        <CountTile label="Fail" count={state.counts.fail} tone="fail" />
        <CountTile label="Error" count={state.counts.error} tone="error" />
      </div>

      {state.phase === 'running' && currentImage ? (
        <div className="mt-4 flex items-center gap-4 rounded-lg border border-outline-variant bg-surface-container p-3">
          <img
            src={imageUrlFor(currentImage)}
            alt={currentImage.filename}
            className="h-16 w-16 rounded-lg object-cover ring-1 ring-outline-variant"
          />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xs text-on-surface-variant">
              Processing
            </div>
            <div className="truncate font-medium text-on-surface">
              {currentImage.filename}
            </div>
            <div className="text-xs text-on-surface-variant">
              {currentImage.beverageType} · expected{' '}
              {currentImage.expectedRecommendation ?? 'n/a'}
            </div>
          </div>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : null}

      {state.phase === 'error' ? (
        <div className="mt-4 rounded-lg border border-error bg-error-container p-3 text-sm text-on-error-container">
          <div className="font-medium">Run failed</div>
          <div className="mt-1">{state.error}</div>
        </div>
      ) : null}
    </section>
  );
}

function MetricChip(props: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-xs uppercase tracking-wide text-on-surface-variant">
        {props.label}
      </span>
      <span className="font-mono text-sm text-on-surface">{props.value}</span>
    </div>
  );
}

function CountTile(props: {
  label: string;
  count: number;
  tone: 'pass' | 'review' | 'fail' | 'error';
}) {
  const tones: Record<typeof props.tone, string> = {
    pass: 'bg-tertiary-container text-on-tertiary-container',
    review: 'bg-caution-container text-on-caution-container',
    fail: 'bg-error-container text-on-error-container',
    error: 'bg-surface-container-high text-on-surface'
  };

  return (
    <div
      className={`rounded-lg border border-outline-variant p-3 ${tones[props.tone]}`}
    >
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">
        {props.label}
      </div>
      <div className="font-headline text-2xl">{props.count}</div>
    </div>
  );
}

function findCurrentImage(input: {
  pack: EvalPack | null;
  completedImageIds: Set<string>;
}): EvalPackImage | null {
  if (!input.pack) return null;

  const { pack, completedImageIds } = input;
  // The server assigns clientIds of the form `{packId}-{image.id}-{index}`.
  // To find the next in-flight image, find the first pack image whose
  // corresponding clientId is not yet in the completed set.
  for (let index = 0; index < pack.images.length; index += 1) {
    const packImage = pack.images[index];
    const clientId = `${pack.id}-${packImage.id}-${index}`;
    if (!completedImageIds.has(clientId)) {
      return packImage;
    }
  }

  return null;
}
