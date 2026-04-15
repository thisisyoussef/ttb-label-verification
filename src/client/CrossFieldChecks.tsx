import { FieldRow } from './FieldRow';
import type { CheckReview } from './types';

interface CrossFieldChecksProps {
  checks: CheckReview[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  standalone: boolean;
  rowRefs: Map<string, HTMLButtonElement>;
  onKeyNav: (event: React.KeyboardEvent<HTMLButtonElement>, id: string) => void;
}

export function CrossFieldChecks({
  checks,
  expandedId,
  onToggle,
  standalone,
  rowRefs,
  onKeyNav
}: CrossFieldChecksProps) {
  const empty = checks.length === 0;

  return (
    <section aria-labelledby="cross-field-heading" className="flex flex-col gap-4">
      <h3
        id="cross-field-heading"
        className="font-headline text-lg font-bold text-on-surface tracking-tight"
      >
        Related checks
      </h3>
      {empty ? (
        <div className="bg-surface-container-low rounded-lg p-4 flex items-center gap-3 text-on-surface-variant">
          <span aria-hidden="true" className="material-symbols-outlined">
            info
          </span>
          <p className="font-body text-sm">No related checks apply to this label.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {checks.map((check) => (
            <FieldRow
              key={check.id}
              check={check}
              expanded={expandedId === check.id}
              onToggle={() => onToggle(check.id)}
              standalone={standalone}
              rowRef={(node) => {
                if (node) rowRefs.set(check.id, node);
                else rowRefs.delete(check.id);
              }}
              onKeyNav={(event) => onKeyNav(event, check.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
