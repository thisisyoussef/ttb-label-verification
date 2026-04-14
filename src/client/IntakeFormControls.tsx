import type { ReactNode } from 'react';

import type {
  BeverageSelection,
  OriginChoice
} from './types';

export function abvTagFor(
  beverage: BeverageSelection
): 'MANDATORY' | 'OPTIONAL' | null {
  if (beverage === 'distilled-spirits' || beverage === 'wine') {
    return 'MANDATORY';
  }

  if (beverage === 'malt-beverage') {
    return 'OPTIONAL';
  }

  return null;
}

export function FieldGroupHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
      {children}
    </h2>
  );
}

export function FieldGroup({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-6 border-0 p-0">
      <legend className="font-headline text-sm font-bold uppercase tracking-wider text-on-surface">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

export function IntakeFieldRow({
  children,
  columns = 1
}: {
  children: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <div
      className={
        columns === 2
          ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
          : 'grid grid-cols-1 gap-6'
      }
    >
      {children}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  tag?: 'MANDATORY' | 'OPTIONAL' | null;
  monospace?: boolean;
  onChange: (value: string) => void;
}

export function TextField({
  label,
  value,
  placeholder,
  hint,
  tag,
  monospace,
  onChange
}: TextFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between">
        <span className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
        </span>
        {tag ? <Tag variant={tag} /> : null}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={[
          'bg-surface-container-lowest border-0 border-b-2 border-outline-variant/20 focus:border-primary focus:ring-0 text-on-surface py-3 px-3 rounded-t-sm transition-colors',
          monospace ? 'font-mono' : 'font-body'
        ].join(' ')}
      />
      {hint ? (
        <span className="text-xs text-on-surface-variant/80 font-label">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

interface TextAreaFieldProps {
  label: string;
  value: string;
  hint?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function TextAreaField({
  label,
  value,
  hint,
  placeholder,
  onChange
}: TextAreaFieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
        {label}
      </span>
      <textarea
        value={value}
        rows={3}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="bg-surface-container-lowest border border-outline-variant/20 focus:border-primary focus:ring-0 text-on-surface py-3 px-3 rounded-lg font-body resize-none"
      />
      {hint ? (
        <span className="text-xs text-on-surface-variant/80 font-label">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function OriginField({
  value,
  onChange
}: {
  value: OriginChoice;
  onChange: (value: OriginChoice) => void;
}) {
  const options: { value: OriginChoice; label: string }[] = [
    { value: 'domestic', label: 'Domestic' },
    { value: 'imported', label: 'Imported' }
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
        Origin
      </span>
      <div
        role="radiogroup"
        aria-label="Origin"
        className="flex border border-outline-variant/30 rounded-lg overflow-hidden h-[46px]"
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className={[
                'flex-1 text-xs font-semibold uppercase tracking-widest transition-colors',
                isSelected
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
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

function Tag({ variant }: { variant: 'MANDATORY' | 'OPTIONAL' }) {
  const isMandatory = variant === 'MANDATORY';
  return (
    <span
      className={[
        'font-label text-[9px] font-extrabold px-1.5 py-0.5 rounded-sm uppercase tracking-wider',
        isMandatory
          ? 'bg-error/10 text-error'
          : 'bg-surface-container-high text-on-surface-variant'
      ].join(' ')}
    >
      {variant}
    </span>
  );
}
