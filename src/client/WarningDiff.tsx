import { useEffect, useRef, useState } from 'react';
import type { DiffSegment } from './types';

interface WarningDiffProps {
  segments: DiffSegment[];
}

const SEGMENT_CLASS: Record<DiffSegment['kind'], { required: string; extracted: string; aria: string }> =
  {
    match: {
      required: 'text-on-surface',
      extracted: 'text-on-surface',
      aria: 'matching'
    },
    'wrong-case': {
      required: 'bg-caution-container/70 text-on-caution-container',
      extracted: 'bg-caution-container/70 text-on-caution-container font-bold',
      aria: 'wrong capitalization'
    },
    'wrong-character': {
      required: 'bg-error-container/40 text-on-error-container',
      extracted: 'bg-error-container/40 text-on-error-container font-bold',
      aria: 'wrong character'
    },
    missing: {
      required: 'bg-error-container/40 text-on-error-container underline',
      extracted: 'bg-error-container/20 text-on-error-container italic',
      aria: 'missing character'
    }
  };

function summarize(segments: DiffSegment[]) {
  let wrongChars = 0;
  let wrongCase = 0;
  let missing = 0;
  for (const seg of segments) {
    if (seg.kind === 'wrong-character') wrongChars += Math.max(seg.required.length, seg.extracted.length);
    else if (seg.kind === 'wrong-case') wrongCase += 1;
    else if (seg.kind === 'missing') missing += Math.max(seg.required.length, 1);
  }
  return { wrongChars, wrongCase, missing };
}

export function WarningDiff({ segments }: WarningDiffProps) {
  const [capped, setCapped] = useState(true);
  const [needsCap, setNeedsCap] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => setNeedsCap(el.scrollHeight > 200);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [segments]);

  const stats = summarize(segments);
  const clean = stats.wrongChars === 0 && stats.wrongCase === 0 && stats.missing === 0;
  const summaryText = clean
    ? 'Extracted text matches required wording.'
    : [
        stats.wrongCase > 0 ? `${stats.wrongCase} segment${stats.wrongCase === 1 ? '' : 's'} with wrong capitalization` : null,
        stats.wrongChars > 0 ? `${stats.wrongChars} wrong character${stats.wrongChars === 1 ? '' : 's'}` : null,
        stats.missing > 0 ? `${stats.missing} missing character${stats.missing === 1 ? '' : 's'}` : null
      ]
        .filter(Boolean)
        .join(', ');

  return (
    <div className="flex flex-col gap-3">
      <p className="sr-only" aria-live="polite">
        Warning text comparison summary. {summaryText}.
      </p>
      <div
        ref={contentRef}
        className={[
          'bg-surface-container-highest rounded-lg border border-outline-variant/20 p-4 overflow-x-auto transition-[max-height] duration-200',
          needsCap && capped ? 'max-h-[200px] overflow-y-hidden' : ''
        ].join(' ')}
      >
        <DiffRow
          label="Required warning"
          segments={segments}
          field="required"
        />
        <div className="h-px bg-outline-variant/20 my-3" />
        <DiffRow
          label="Read from label"
          segments={segments}
          field="extracted"
        />
      </div>
      {needsCap ? (
        <button
          type="button"
          onClick={() => setCapped((prev) => !prev)}
          className="text-xs font-label font-semibold text-primary hover:underline flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            {capped ? 'expand_more' : 'expand_less'}
          </span>
          {capped ? 'Show full text' : 'Show less'}
        </button>
      ) : null}
      <DiffLegend />
    </div>
  );
}

function DiffRow({
  label,
  segments,
  field
}: {
  label: string;
  segments: DiffSegment[];
  field: 'required' | 'extracted';
}) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:gap-4">
      <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant md:w-28 md:flex-shrink-0">
        {label}
      </span>
      <p className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-on-surface">
        {segments.map((seg, index) => {
          const text = field === 'required' ? seg.required : seg.extracted;
          if (text.length === 0) return null;
          const cls = SEGMENT_CLASS[seg.kind][field];
          const aria =
            seg.kind === 'match'
              ? undefined
              : `${SEGMENT_CLASS[seg.kind].aria}: ${text}`;
          return (
            <span key={`${field}-${index}`} className={cls} aria-label={aria}>
              {text}
            </span>
          );
        })}
      </p>
    </div>
  );
}

function DiffLegend() {
  const items = [
    { label: 'Wrong capitalization', cls: 'bg-caution-container/70' },
    { label: 'Wrong character', cls: 'bg-error-container/40' },
    { label: 'Missing character', cls: 'bg-error-container/40 border-b-2 border-error' }
  ];
  return (
    <ul className="flex flex-wrap gap-4">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-2 font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
        >
          <span className={`inline-block w-4 h-3 rounded-sm ${item.cls}`} aria-hidden="true" />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
