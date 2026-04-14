import type { BeverageSelection } from './types';

interface Option {
  value: BeverageSelection;
  label: string;
}

const OPTIONS: Option[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'distilled-spirits', label: 'Distilled Spirits' },
  { value: 'malt-beverage', label: 'Malt Beverage' },
  { value: 'wine', label: 'Wine' }
];

interface BeverageTypeFieldProps {
  value: BeverageSelection;
  onChange: (value: BeverageSelection) => void;
}

export function BeverageTypeField({ value, onChange }: BeverageTypeFieldProps) {
  return (
    <div className="flex flex-col gap-3">
      <label
        id="beverage-type-label"
        className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
      >
        Beverage type
      </label>
      <div
        role="radiogroup"
        aria-labelledby="beverage-type-label"
        className="flex bg-surface-container-highest p-1 rounded-md gap-1"
      >
        {OPTIONS.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={[
                'flex-1 py-2 text-sm rounded transition-colors',
                isSelected
                  ? 'bg-surface-container-lowest text-on-surface shadow-ambient font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface font-medium'
              ].join(' ')}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
