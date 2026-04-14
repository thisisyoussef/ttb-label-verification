import { useState } from 'react';
import type { ReactNode } from 'react';
import { BeverageTypeField } from './BeverageTypeField';
import { DropZone } from './DropZone';
import { VarietalsTable } from './VarietalsTable';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage,
  OriginChoice
} from './types';

interface IntakeProps {
  image: LabelImage | null;
  beverage: BeverageSelection;
  fields: IntakeFields;
  onImageChange: (image: LabelImage | null) => void;
  onBeverageChange: (value: BeverageSelection) => void;
  onFieldsChange: (fields: IntakeFields) => void;
  onVerify: () => void;
  onClear: () => void;
}

export function Intake({
  image,
  beverage,
  fields,
  onImageChange,
  onBeverageChange,
  onFieldsChange,
  onVerify,
  onClear
}: IntakeProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);
  const verifyDisabled = image === null;

  const setField = <K extends keyof IntakeFields>(key: K, value: IntakeFields[K]) => {
    onFieldsChange({ ...fields, [key]: value });
  };

  const abvTag = abvTagFor(beverage);
  const showWineFields = beverage === 'wine';

  const onPrimary = () => {
    if (verifyDisabled) return;
    onVerify();
  };

  const onFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter') {
      const target = event.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') return;
      event.preventDefault();
      onPrimary();
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto w-full px-6 py-10">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onPrimary();
        }}
        onKeyDown={onFormKeyDown}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8"
      >
        <section className="lg:col-span-5 flex flex-col">
          <FieldGroupHeading>Label image</FieldGroupHeading>
          <DropZone image={image} onAccept={onImageChange} onRemove={() => onImageChange(null)} />
        </section>

        <section className="lg:col-span-7 flex flex-col">
          <FieldGroupHeading>Application data</FieldGroupHeading>

          <div className="bg-surface-container-low rounded-lg p-6 md:p-8 flex flex-col gap-8">
            <BeverageTypeField value={beverage} onChange={onBeverageChange} />

            <FieldGroup title="Identity">
              <FieldRow>
                <TextField
                  label="Brand name"
                  placeholder="e.g., Stone's Throw"
                  value={fields.brandName}
                  onChange={(value) => setField('brandName', value)}
                />
              </FieldRow>
              <FieldRow columns={2}>
                <TextField
                  label="Fanciful name"
                  hint="Optional"
                  placeholder="e.g., Small Batch Reserve"
                  value={fields.fancifulName}
                  onChange={(value) => setField('fancifulName', value)}
                />
                <TextField
                  label="Class / type"
                  placeholder="e.g., Kentucky Straight Bourbon"
                  value={fields.classType}
                  onChange={(value) => setField('classType', value)}
                />
              </FieldRow>
            </FieldGroup>

            <FieldGroup title="Alcohol and measure">
              <FieldRow columns={2}>
                <TextField
                  label="Alcohol content"
                  hint="e.g., 45% Alc./Vol."
                  placeholder="e.g., 45% Alc./Vol."
                  tag={abvTag}
                  monospace
                  value={fields.alcoholContent}
                  onChange={(value) => setField('alcoholContent', value)}
                />
                <TextField
                  label="Net contents"
                  hint="e.g., 750 mL"
                  placeholder="e.g., 750 mL"
                  monospace
                  value={fields.netContents}
                  onChange={(value) => setField('netContents', value)}
                />
              </FieldRow>
            </FieldGroup>

            <FieldGroup title="Origin and applicant">
              <FieldRow>
                <TextAreaField
                  label="Applicant name & address"
                  hint="Name, city, and state exactly as on the permit."
                  placeholder={'Stone Throw Distilling Co.\nLouisville, KY'}
                  value={fields.applicantAddress}
                  onChange={(value) => setField('applicantAddress', value)}
                />
              </FieldRow>
              <FieldRow columns={2}>
                <OriginField
                  value={fields.origin}
                  onChange={(value) => setField('origin', value)}
                />
                {fields.origin === 'imported' ? (
                  <TextField
                    label="Country"
                    placeholder="e.g., France"
                    value={fields.country}
                    onChange={(value) => setField('country', value)}
                  />
                ) : (
                  <TextField
                    label="Formula ID"
                    hint="Optional"
                    placeholder="If assigned"
                    value={fields.formulaId}
                    onChange={(value) => setField('formulaId', value)}
                  />
                )}
              </FieldRow>
              {fields.origin === 'imported' ? (
                <FieldRow>
                  <TextField
                    label="Formula ID"
                    hint="Optional"
                    placeholder="If assigned"
                    value={fields.formulaId}
                    onChange={(value) => setField('formulaId', value)}
                  />
                </FieldRow>
              ) : null}
            </FieldGroup>

            {showWineFields ? (
              <FieldGroup title="Wine details">
                <FieldRow columns={2}>
                  <TextField
                    label="Appellation"
                    placeholder="e.g., Napa Valley"
                    value={fields.appellation}
                    onChange={(value) => setField('appellation', value)}
                  />
                  <TextField
                    label="Vintage"
                    placeholder="e.g., 2021"
                    monospace
                    value={fields.vintage}
                    onChange={(value) => setField('vintage', value)}
                  />
                </FieldRow>
                <VarietalsTable
                  rows={fields.varietals}
                  onChange={(rows) => setField('varietals', rows)}
                />
              </FieldGroup>
            ) : null}
          </div>
        </section>

        <section className="lg:col-span-12 mt-2">
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-6 py-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between shadow-ambient">
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                shield
              </span>
              <p className="text-sm font-label">
                Nothing is stored. Inputs and results are discarded when you leave.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {confirmingClear ? (
                <>
                  <span className="text-sm font-label text-on-surface-variant">
                    Clear everything? You'll lose the current intake.
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    className="px-4 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingClear(false);
                      onClear();
                    }}
                    className="px-4 py-2 text-sm font-semibold text-error hover:underline"
                  >
                    Clear
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingClear(true)}
                  className="px-6 py-2.5 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Clear
                </button>
              )}
              <div className="relative group">
                <button
                  type="submit"
                  disabled={verifyDisabled}
                  data-tour-target="tour-verify-button"
                  aria-describedby={verifyDisabled ? 'verify-disabled-hint' : undefined}
                  className={[
                    'px-8 py-2.5 rounded-lg text-sm font-bold uppercase tracking-widest flex items-center gap-2 transition-all',
                    verifyDisabled
                      ? 'bg-surface-container-highest text-outline-variant/70 cursor-not-allowed'
                      : 'bg-gradient-to-b from-primary to-primary-dim text-on-primary shadow-ambient hover:brightness-110 active:scale-[0.98]'
                  ].join(' ')}
                >
                  Verify Label
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    arrow_forward
                  </span>
                </button>
                {verifyDisabled ? (
                  <div
                    id="verify-disabled-hint"
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap bg-on-surface text-surface text-xs font-label px-3 py-1.5 rounded shadow-ambient opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                  >
                    Add a label image to verify.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}

function abvTagFor(beverage: BeverageSelection): 'MANDATORY' | 'OPTIONAL' | null {
  if (beverage === 'distilled-spirits' || beverage === 'wine') return 'MANDATORY';
  if (beverage === 'malt-beverage') return 'OPTIONAL';
  return null;
}

function FieldGroupHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-label text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
      {children}
    </h2>
  );
}

function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-6 border-0 p-0">
      <legend className="font-headline text-sm font-bold uppercase tracking-wider text-on-surface">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function FieldRow({
  children,
  columns = 1
}: {
  children: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <div className={columns === 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'grid grid-cols-1 gap-6'}>
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

function TextField({ label, value, placeholder, hint, tag, monospace, onChange }: TextFieldProps) {
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
        <span className="text-xs text-on-surface-variant/80 font-label">{hint}</span>
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

function TextAreaField({ label, value, hint, placeholder, onChange }: TextAreaFieldProps) {
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
        <span className="text-xs text-on-surface-variant/80 font-label">{hint}</span>
      ) : null}
    </label>
  );
}

function OriginField({
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
        isMandatory ? 'bg-error/10 text-error' : 'bg-surface-container-high text-on-surface-variant'
      ].join(' ')}
    >
      {variant}
    </span>
  );
}
