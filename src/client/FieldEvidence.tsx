import { plainifyCheckReason, plainifyReason } from './reviewDisplayAdapter';
import type { CheckReview } from './types';

interface FieldEvidencePanelProps {
  check: CheckReview;
  standalone: boolean;
}

// Confidence threshold below which we surface a "verify visually" hint
// to the reviewer. The numeric confidence itself is never displayed —
// we keep the signal internal and only expose a qualitative prompt.
const VERIFY_VISUALLY_THRESHOLD = 0.6;

// Sentinel phrase the server writes into `comparison.note` when the
// extracted value came from the OCR fallback rather than the VLM read.
// Kept in sync with `OCR_FALLBACK_SENTINEL` in
// `src/server/review-report-field-checks.ts`. Substring match is safe:
// the phrase is plain prose and does not appear in any other copy.
const OCR_FALLBACK_MARKER = 'likely from the label (not verified by the vision model)';

function isOcrFallbackNote(note: string | undefined): boolean {
  return typeof note === 'string' && note.includes(OCR_FALLBACK_MARKER);
}

export function FieldEvidencePanel({ check, standalone }: FieldEvidencePanelProps) {
  const showComparison =
    !standalone &&
    check.comparison &&
    (check.comparison.status === 'case-mismatch' ||
      check.comparison.status === 'value-mismatch');
  const uncertain = check.confidence < VERIFY_VISUALLY_THRESHOLD;
  const summaryText = plainifyCheckReason(check);
  const detailsText = plainifyReason(check.details ?? '');

  return (
    <div className="flex flex-col gap-6 px-6 md:px-8 pt-4 pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            What we found
          </h4>
          <p className="font-headline text-lg font-bold text-on-surface">{summaryText}</p>
          {detailsText.length > 0 && detailsText !== summaryText ? (
            <p className="font-body text-sm text-on-surface-variant leading-relaxed">
              {detailsText}
            </p>
          ) : null}
          {uncertain ? (
            <p className="text-sm text-caution font-label">
              Hard to read — please verify against the physical label.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 bg-surface-container-low rounded-lg p-5">
          <div className="flex flex-col gap-1.5">
            <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              Regulatory reference
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
              <p className="font-body text-xs text-on-surface-variant">
                No direct citation — general label review.
              </p>
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

  const likelyFromOcr = isOcrFallbackNote(comparison.note);

  return (
    <section
      className="flex flex-col gap-3"
      aria-label={`Comparison for ${check.label}`}
    >
      <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
        Comparison
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComparisonCell
          label="Application data"
          value={check.applicationValue}
          toneClass={toneClass}
          blankCopy="Not in the application"
        />
        <ComparisonCell
          label="Read from label"
          value={check.extractedValue}
          toneClass={toneClass}
          blankCopy="Not visible on the label"
          likely={likelyFromOcr}
        />
      </div>
      {comparison.note ? (
        <p className="font-body text-xs text-on-surface-variant">
          {plainifyReason(comparison.note)}
        </p>
      ) : null}
    </section>
  );
}

function ComparisonCell({
  label,
  value,
  toneClass,
  blankCopy,
  likely = false
}: {
  label: string;
  value: string | undefined;
  toneClass: string;
  blankCopy: string;
  likely?: boolean;
}) {
  const hasValue = Boolean(value && value.length > 0);
  return (
    <div className="bg-surface-container-low rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h5 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </h5>
        {hasValue && likely ? (
          <span
            className="font-label text-[10px] font-bold uppercase tracking-widest text-caution bg-caution/10 px-2 py-0.5 rounded"
            title="The vision model didn't read this field cleanly — shown from the label text directly."
          >
            Likely
          </span>
        ) : null}
      </div>
      {hasValue ? (
        <p
          className={[
            'font-mono text-base font-semibold tracking-tight text-on-surface bg-surface-container-highest px-3 py-2 rounded ring-1',
            toneClass
          ].join(' ')}
        >
          {value}
        </p>
      ) : (
        <p className="font-body text-sm italic text-on-surface-variant px-3 py-2">
          {blankCopy}
        </p>
      )}
    </div>
  );
}
