import type { VarietalRow } from './types';

interface VarietalsTableProps {
  rows: VarietalRow[];
  onChange: (rows: VarietalRow[]) => void;
}

function createRow(): VarietalRow {
  return { id: crypto.randomUUID(), name: '', percentage: '' };
}

export function VarietalsTable({ rows, onChange }: VarietalsTableProps) {
  const total = rows.reduce((acc, row) => {
    const value = Number.parseFloat(row.percentage);
    return Number.isFinite(value) ? acc + value : acc;
  }, 0);

  const totalDisplay = Number.isInteger(total) ? total.toString() : total.toFixed(1);
  const isComplete = Math.abs(total - 100) < 0.01;

  const updateRow = (id: string, patch: Partial<VarietalRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id));
  };

  const addRow = () => onChange([...rows, createRow()]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-end">
        <label className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          Varietals
        </label>
        <button
          type="button"
          onClick={addRow}
          className="text-primary text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 hover:underline"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add varietal
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-outline-variant/20">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low">
              <th
                scope="col"
                className="px-4 py-2 text-[10px] font-bold uppercase text-on-surface-variant font-label"
              >
                Varietal name
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-[10px] font-bold uppercase text-on-surface-variant font-label text-right w-32"
              >
                Percentage (%)
              </th>
              <th scope="col" className="px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-4 text-sm text-on-surface-variant italic bg-surface-container-lowest"
                >
                  No varietals entered.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={index % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/30'}
                >
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={row.name}
                      placeholder="e.g., Cabernet Sauvignon"
                      onChange={(event) => updateRow(row.id, { name: event.target.value })}
                      className="w-full bg-transparent border-0 focus:ring-0 text-sm text-on-surface placeholder:text-on-surface-variant/50 px-0 py-1"
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.percentage}
                      placeholder="0"
                      onChange={(event) => updateRow(row.id, { percentage: event.target.value })}
                      className="w-full bg-transparent border-0 focus:ring-0 text-sm font-mono text-on-surface text-right placeholder:text-on-surface-variant/50 px-0 py-1"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      aria-label={`Remove ${row.name || 'varietal'}`}
                      onClick={() => removeRow(row.id)}
                      className="text-on-surface-variant/40 hover:text-error transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center px-1">
        <p
          className={[
            'text-[11px] font-bold uppercase',
            isComplete ? 'text-tertiary' : 'text-error'
          ].join(' ')}
        >
          Total: {totalDisplay}% (must equal 100% to qualify)
        </p>
        <div className="w-32 h-1 bg-surface-container rounded-full overflow-hidden">
          <div
            className={[
              'h-full transition-all',
              isComplete ? 'bg-tertiary' : 'bg-error'
            ].join(' ')}
            style={{ width: `${Math.min(100, total)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
