import type { ProcessingStep } from './types';

/**
 * Presentational helpers extracted from Processing.tsx so the
 * orchestrator stays under the source-size cap. Each helper is
 * pure-prop in / JSX out — no shared state, no effects, no data
 * fetching. Keeping them grouped here lets the Processing screen
 * read top-to-bottom as flow rather than markup.
 */

export function StepRow({
  step,
  index,
  reducedMotion
}: {
  step: ProcessingStep;
  index: number;
  reducedMotion: boolean;
}) {
  const baseRow = 'flex items-center gap-5 p-4 rounded-lg transition-colors';
  const variantClass =
    step.status === 'active'
      ? 'bg-surface-container-low'
      : step.status === 'failed'
        ? 'bg-error-container/15 border-l-4 border-error'
        : step.status === 'done'
          ? 'hover:bg-surface-container-low/70'
          : 'opacity-50';

  const statusTag =
    step.status === 'done'
      ? 'Done'
      : step.status === 'active'
        ? 'Active'
        : step.status === 'failed'
          ? 'Failed'
          : 'Pending';

  const statusToneClass =
    step.status === 'done'
      ? 'text-tertiary'
      : step.status === 'active'
        ? 'text-primary'
        : step.status === 'failed'
          ? 'text-error'
          : 'text-on-surface-variant';

  return (
    <div className={[baseRow, variantClass].join(' ')}>
      <StepIcon step={step} index={index} reducedMotion={reducedMotion} />
      <div className="flex-1 flex flex-col">
        <span className="font-body font-semibold text-on-surface">
          {index}. {step.label}
        </span>
        <span
          className={[
            'font-label text-xs font-bold uppercase tracking-wider',
            statusToneClass
          ].join(' ')}
        >
          {statusTag}
        </span>
      </div>
    </div>
  );
}

function StepIcon({
  step,
  index,
  reducedMotion
}: {
  step: ProcessingStep;
  index: number;
  reducedMotion: boolean;
}) {
  if (step.status === 'done') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary-container flex-shrink-0">
        <span
          className="material-symbols-outlined text-[20px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          check
        </span>
      </div>
    );
  }
  if (step.status === 'active') {
    return (
      <div className="flex items-center justify-center w-8 h-8 flex-shrink-0">
        {reducedMotion ? (
          <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
            pending
          </span>
        ) : (
          <div className="step-ring animate-spin" aria-hidden="true" />
        )}
        <span className="sr-only">In progress</span>
      </div>
    );
  }
  if (step.status === 'failed') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-error text-on-error flex-shrink-0">
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          close
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-outline-variant/60 text-outline-variant flex-shrink-0">
      <span className="text-xs font-bold">{index}</span>
    </div>
  );
}

/**
 * Compact horizontal progress strip that replaces the full step list
 * while the pipeline runs. Each step is a small dot; the active one
 * pulses (unless reducedMotion), completed ones stay solid. Sits
 * under the page header so the reviewer sees "where we are" without
 * the full ladder taking over the viewport.
 */
export function ProgressStrip({
  steps,
  reducedMotion
}: {
  steps: ProcessingStep[];
  reducedMotion: boolean;
}) {
  const activeStep = steps.find((step) => step.status === 'active');
  const activeLabel = activeStep?.label ?? 'Finishing up';

  return (
    <div className="flex flex-col gap-2 max-w-3xl" aria-label="Pipeline progress">
      <div className="flex items-center gap-2">
        {steps.map((step, index) => (
          <StepDot
            key={step.id}
            step={step}
            reducedMotion={reducedMotion}
            isLast={index === steps.length - 1}
          />
        ))}
      </div>
      <p className="font-body text-sm text-on-surface-variant">{activeLabel}</p>
    </div>
  );
}

function StepDot({
  step,
  reducedMotion,
  isLast
}: {
  step: ProcessingStep;
  reducedMotion: boolean;
  isLast: boolean;
}) {
  const base = 'h-1.5 flex-1 rounded-full transition-colors duration-500';
  let toneClass = 'bg-outline-variant/30';
  if (step.status === 'done') toneClass = 'bg-primary';
  if (step.status === 'active') {
    toneClass = reducedMotion
      ? 'bg-primary/60'
      : 'bg-primary/60 animate-pulse';
  }
  if (step.status === 'failed') toneClass = 'bg-error';
  return (
    <>
      <span className={`${base} ${toneClass}`} aria-hidden="true" />
      {isLast ? null : <span className="sr-only">, </span>}
    </>
  );
}

/**
 * Skeleton row that matches the Results FieldRow visual footprint so
 * the flip from Processing to Results is a value-swap, not a
 * re-layout. Three visual states:
 *   - skeleton (no OCR value yet): shimmering placeholder bar
 *   - provisional (OCR value present): monospaced value with "likely"
 *     eyebrow in a subdued tone
 *   - final (handled by Results — never rendered here)
 */
export function SkeletonFieldRow({
  label,
  value,
  reducedMotion
}: {
  label: string;
  value: string | undefined;
  reducedMotion: boolean;
}) {
  const hasValue = typeof value === 'string' && value.length > 0;
  return (
    <div
      className={[
        'flex items-center gap-4 px-5 py-3 rounded-lg',
        'bg-surface-container-low/60 border border-outline-variant/15',
        'transition-all duration-500',
        hasValue ? 'ring-1 ring-primary/20' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="w-[30%] shrink-0">
        <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        {hasValue ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-on-surface truncate">
              {value}
            </span>
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-primary/70">
              likely
            </span>
          </div>
        ) : (
          <span
            className={[
              'block h-4 w-full max-w-[280px] rounded bg-outline-variant/20',
              reducedMotion ? '' : 'animate-pulse'
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Warning-present skeleton row. OCR tells us YES/NO on whether the
 * warning paragraph is detectable on the label; the exact text quality
 * is verified by the full pipeline downstream.
 */
export function WarningSkeletonRow({
  detected,
  reducedMotion
}: {
  detected: boolean | undefined;
  reducedMotion: boolean;
}) {
  const known = typeof detected === 'boolean';
  return (
    <div
      className={[
        'flex items-center gap-4 px-5 py-3 rounded-lg',
        'bg-surface-container-low/60 border border-outline-variant/15',
        'transition-all duration-500',
        known ? 'ring-1 ring-primary/20' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="w-[30%] shrink-0">
        <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Government warning
        </span>
      </div>
      <div className="flex-1 min-w-0">
        {known ? (
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={[
                'material-symbols-outlined text-[18px]',
                detected ? 'text-success' : 'text-caution'
              ].join(' ')}
            >
              {detected ? 'check_circle' : 'help'}
            </span>
            <span className="font-body text-sm font-semibold text-on-surface">
              {detected
                ? 'Warning text detected on the label.'
                : 'Warning text not detected yet.'}
            </span>
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-primary/70 ml-auto">
              likely
            </span>
          </div>
        ) : (
          <span
            className={[
              'block h-4 w-full max-w-[320px] rounded bg-outline-variant/20',
              reducedMotion ? '' : 'animate-pulse'
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
