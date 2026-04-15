import { ConfidenceMeter } from './ConfidenceMeter';
import type { CheckReview } from './types';

interface FieldEvidencePanelProps {
  check: CheckReview;
  standalone: boolean;
}

const SEVERITY_COPY: Record<CheckReview['severity'], string> = {
  blocker: 'Must fix',
  major: 'Important',
  minor: 'Minor',
  note: 'Note'
};

export function FieldEvidencePanel({ check, standalone }: FieldEvidencePanelProps) {
  const showSeverity = check.status !== 'pass';
  const showComparison =
    !standalone &&
    check.comparison &&
    (check.comparison.status === 'case-mismatch' ||
      check.comparison.status === 'value-mismatch');

  return (
    <div className="flex flex-col gap-6 px-6 md:px-8 pt-4 pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            Finding
          </h4>
          <p className="font-headline text-lg font-bold text-on-surface">{check.summary}</p>
          <p className="font-body text-sm text-on-surface-variant leading-relaxed">
            {check.details}
          </p>
          {showSeverity ? (
            <p className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              Severity: <span className="text-on-surface">{SEVERITY_COPY[check.severity]}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 bg-surface-container-low rounded-lg p-5">
          <ConfidenceMeter confidence={check.confidence} />
          <div className="flex flex-col gap-1.5">
            <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              Citations
            </h4>
            {check.citations.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {check.citations.map((citation) => (
                  <li key={citation} className="font-mono text-xs text-on-surface">
                    {citation}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-body text-xs text-on-surface-variant">No direct citation.</p>
            )}
          </div>
        </div>
      </div>

      {showComparison ? <ComparisonBlock check={check} /> : null}
    </div>
  );
}

function ComparisonBlock({ check }: { check: CheckReview }) {
  const comparison = check.comparison;
  if (!comparison) return null;

  const toneClass =
    comparison.status === 'case-mismatch'
      ? 'ring-caution/40'
      : 'ring-error/40';

  return (
    <section
      className="flex flex-col gap-3"
      aria-label={`Comparison for ${check.label}`}
    >
      <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
        Comparison
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComparisonCell label="Application data" value={check.applicationValue} toneClass={toneClass} />
        <ComparisonCell label="Read from label" value={check.extractedValue} toneClass={toneClass} />
      </div>
      {comparison.note ? (
        <p className="font-body text-xs text-on-surface-variant">{comparison.note}</p>
      ) : null}
    </section>
  );
}

function ComparisonCell({
  label,
  value,
  toneClass
}: {
  label: string;
  value: string | undefined;
  toneClass: string;
}) {
  return (
    <div className="bg-surface-container-low rounded-lg p-4">
      <h5 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
        {label}
      </h5>
      <p
        className={[
          'font-mono text-base font-semibold tracking-tight text-on-surface bg-surface-container-highest px-3 py-2 rounded ring-1',
          toneClass
        ].join(' ')}
      >
        {value && value.length > 0 ? value : '—'}
      </p>
    </div>
  );
}
