import { useState } from 'react';
import { BeverageTypeField } from './BeverageTypeField';
import { useHint } from './useHint';
import { DropZone } from './DropZone';
import {
  abvTagFor,
  FieldGroup,
  FieldGroupHeading,
  IntakeFieldRow,
  OriginField,
  TextAreaField,
  TextField
} from './IntakeFormControls';
import { PasteFromJson } from './PasteFromJson';
import { VarietalsTable } from './VarietalsTable';
import { WelcomePrompt } from './WelcomePrompt';
import type {
  BeverageSelection,
  IntakeFields,
  LabelImage
} from './types';

function isFieldsEmpty(fields: IntakeFields): boolean {
  return (
    !fields.brandName &&
    !fields.fancifulName &&
    !fields.classType &&
    !fields.alcoholContent &&
    !fields.netContents &&
    !fields.applicantAddress &&
    !fields.country &&
    !fields.formulaId &&
    !fields.appellation &&
    !fields.vintage &&
    (fields.varietals.length === 0 ||
      fields.varietals.every((row) => !row.name && !row.percentage))
  );
}

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
  const jsonPasteHint = useHint('json-paste', image !== null);

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
    <div className="h-[calc(100dvh-var(--header-h))] flex flex-col max-w-[1400px] mx-auto w-full">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onPrimary();
        }}
        onKeyDown={onFormKeyDown}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="flex-1 overflow-y-auto px-6 py-4 xl:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <section className="lg:col-span-5 flex flex-col">
              <FieldGroupHeading>Label image</FieldGroupHeading>
              <DropZone image={image} onAccept={onImageChange} onRemove={() => onImageChange(null)} />
              {jsonPasteHint.visible && !image ? (
                <p className="text-xs text-on-surface-variant/70 font-label flex items-center gap-1.5 mt-2">
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">lightbulb</span>
                  You can also paste JSON to pre-fill the form.
                </p>
              ) : null}
            </section>

            <section className="lg:col-span-7 flex flex-col">
              <FieldGroupHeading>Declared values from the COLA application</FieldGroupHeading>
              <p className="text-sm text-on-surface-variant font-body mb-3 -mt-1">
                Enter the declared values from the COLA (Certificate of Label Approval) application.
                We'll compare them to what we read from the label.
              </p>

              {image === null && isFieldsEmpty(fields) ? (
                <WelcomePrompt />
              ) : null}

              <div className="bg-surface-container-low rounded-lg p-5 md:p-6 xl:p-8 flex flex-col gap-6 xl:gap-8">
                <div className="flex flex-col gap-4">
                  <BeverageTypeField value={beverage} onChange={onBeverageChange} />
                  <PasteFromJson
                    fields={fields}
                    onFieldsChange={onFieldsChange}
                    onBeverageChange={onBeverageChange}
                  />
                </div>

                <FieldGroup title="Identity & classification">
                  <IntakeFieldRow>
                    <TextField
                      label="Brand name"
                      placeholder="Stone's Throw"
                      value={fields.brandName}
                      onChange={(value) => setField('brandName', value)}
                    />
                  </IntakeFieldRow>
                  <IntakeFieldRow columns={2}>
                    <TextField
                      label="Class / type"
                      placeholder="Kentucky Straight Bourbon"
                      value={fields.classType}
                      onChange={(value) => setField('classType', value)}
                    />
                    <TextField
                      label="Fanciful name"
                      hint="Optional"
                      placeholder="Small Batch Reserve"
                      value={fields.fancifulName}
                      onChange={(value) => setField('fancifulName', value)}
                    />
                  </IntakeFieldRow>
                </FieldGroup>

                <FieldGroup title="Alcohol and measure">
                  <IntakeFieldRow columns={2}>
                    <TextField
                      label="Alcohol content"
                      hint="Exact format from the COLA"
                      placeholder="45% Alc./Vol."
                      tag={abvTag}
                      monospace
                      value={fields.alcoholContent}
                      onChange={(value) => setField('alcoholContent', value)}
                    />
                    <TextField
                      label="Net contents"
                      hint="Exact format from the COLA"
                      placeholder="750 mL"
                      monospace
                      value={fields.netContents}
                      onChange={(value) => setField('netContents', value)}
                    />
                  </IntakeFieldRow>
                </FieldGroup>

                <FieldGroup title="Origin and applicant">
                  <IntakeFieldRow columns={2}>
                    <OriginField
                      value={fields.origin}
                      onChange={(value) => setField('origin', value)}
                    />
                    {fields.origin === 'imported' ? (
                      <TextField
                        label="Country"
                        placeholder="France"
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
                  </IntakeFieldRow>
                  <IntakeFieldRow>
                    <TextAreaField
                      label="Applicant name & address"
                      hint="Name, city, and state exactly as on the permit."
                      placeholder={'Stone Throw Distilling Co.\nLouisville, KY'}
                      value={fields.applicantAddress}
                      onChange={(value) => setField('applicantAddress', value)}
                    />
                  </IntakeFieldRow>
                  {fields.origin === 'imported' ? (
                    <IntakeFieldRow>
                      <TextField
                        label="Formula ID"
                        hint="Optional"
                        placeholder="If assigned"
                        value={fields.formulaId}
                        onChange={(value) => setField('formulaId', value)}
                      />
                    </IntakeFieldRow>
                  ) : null}
                </FieldGroup>

                {showWineFields ? (
                  <FieldGroup title="Wine details">
                    <IntakeFieldRow columns={2}>
                      <TextField
                        label="Appellation"
                        placeholder="Napa Valley"
                        value={fields.appellation}
                        onChange={(value) => setField('appellation', value)}
                      />
                      <TextField
                        label="Vintage"
                        placeholder="2021"
                        monospace
                        value={fields.vintage}
                        onChange={(value) => setField('vintage', value)}
                      />
                    </IntakeFieldRow>
                    <VarietalsTable
                      rows={fields.varietals}
                      onChange={(rows) => setField('varietals', rows)}
                    />
                  </FieldGroup>
                ) : null}
              </div>

              <p className="text-xs text-on-surface-variant/60 font-label mt-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">info</span>
                Or upload just the image to check it without application data.
              </p>
            </section>
          </div>
        </div>

        <div className="shrink-0 px-6 pb-4 pt-2">
          <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-6 py-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-between shadow-ambient">
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
        </div>
      </form>
    </div>
  );
}
