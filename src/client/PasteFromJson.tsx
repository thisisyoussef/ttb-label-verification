import { useState } from 'react';
import type { BeverageSelection, IntakeFields, OriginChoice } from './types';

const JSON_FIELD_MAP: Record<string, keyof IntakeFields> = {
  brand: 'brandName',
  brandname: 'brandName',
  brand_name: 'brandName',
  fanciful: 'fancifulName',
  fancifulname: 'fancifulName',
  fanciful_name: 'fancifulName',
  class: 'classType',
  classtype: 'classType',
  class_type: 'classType',
  type: 'classType',
  abv: 'alcoholContent',
  alcohol: 'alcoholContent',
  alcoholcontent: 'alcoholContent',
  alcohol_content: 'alcoholContent',
  netcontents: 'netContents',
  net_contents: 'netContents',
  contents: 'netContents',
  volume: 'netContents',
  applicant: 'applicantAddress',
  applicantaddress: 'applicantAddress',
  applicant_address: 'applicantAddress',
  address: 'applicantAddress',
  country: 'country',
  formulaid: 'formulaId',
  formula_id: 'formulaId',
  formula: 'formulaId',
  appellation: 'appellation',
  vintage: 'vintage'
};

const BEVERAGE_MAP: Record<string, BeverageSelection> = {
  spirits: 'distilled-spirits',
  'distilled spirits': 'distilled-spirits',
  'distilled-spirits': 'distilled-spirits',
  wine: 'wine',
  malt: 'malt-beverage',
  'malt beverage': 'malt-beverage',
  'malt-beverage': 'malt-beverage',
  beer: 'malt-beverage',
  auto: 'auto'
};

function parseJsonFields(
  raw: string
): { fields: Partial<IntakeFields>; beverage?: BeverageSelection; error?: string } {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { fields: {}, error: 'That text is not valid JSON. Check the format and try again.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { fields: {}, error: 'Expected a JSON object with curly braces { }, not a list or single value.' };
  }

  const fields: Partial<IntakeFields> = {};
  let beverage: BeverageSelection | undefined;
  const unmapped: string[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    const normalized = key.toLowerCase().replace(/[\s\-_]/g, '');

    if (
      normalized === 'beverage' ||
      normalized === 'beveragetype' ||
      normalized === 'beverage_type'
    ) {
      const bev = BEVERAGE_MAP[String(value).toLowerCase()];
      if (bev) beverage = bev;
      continue;
    }

    if (normalized === 'origin') {
      const originVal = String(value).toLowerCase();
      if (originVal === 'domestic' || originVal === 'imported') {
        fields.origin = originVal as OriginChoice;
      }
      continue;
    }

    const mappedKey = JSON_FIELD_MAP[normalized];
    if (mappedKey && typeof value === 'string') {
      (fields as Record<string, string>)[mappedKey] = value;
    } else if (!mappedKey) {
      unmapped.push(key);
    }
  }

  const error =
    unmapped.length > 0
      ? `Ignored unknown fields: ${unmapped.join(', ')}`
      : undefined;

  return { fields, beverage, error };
}

const JSON_PLACEHOLDER = `{
  "brand": "Stone's Throw",
  "classType": "Kentucky Straight Bourbon",
  "abv": "45% Alc./Vol.",
  "netContents": "750 mL",
  "origin": "domestic",
  "applicant": "Stone Throw Distilling Co.\\nLouisville, KY"
}`;

interface PasteFromJsonProps {
  fields: IntakeFields;
  onFieldsChange: (fields: IntakeFields) => void;
  onBeverageChange: (value: BeverageSelection) => void;
}

export function PasteFromJson({
  fields,
  onFieldsChange,
  onBeverageChange
}: PasteFromJsonProps) {
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  const onApply = () => {
    if (!jsonText.trim()) return;

    const { fields: parsed, beverage, error } = parseJsonFields(jsonText);
    const fieldCount = Object.keys(parsed).length + (beverage ? 1 : 0);

    if (fieldCount === 0 && error) {
      setFeedback({ kind: 'error', message: error });
      return;
    }

    onFieldsChange({ ...fields, ...parsed });
    if (beverage) onBeverageChange(beverage);

    const msg = `Filled ${fieldCount} field${fieldCount !== 1 ? 's' : ''}.`;
    setFeedback({
      kind: error ? 'error' : 'success',
      message: error ? `${msg} ${error}` : msg
    });
    setJsonText('');
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setFeedback(null);
        }}
        className="flex items-center gap-1.5 text-[11px] font-label font-semibold text-on-surface-variant/70 hover:text-on-surface-variant transition-colors uppercase tracking-wider"
      >
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          {open ? 'expand_less' : 'data_object'}
        </span>
        Paste from JSON
      </button>

      {open ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setFeedback(null);
            }}
            placeholder={JSON_PLACEHOLDER}
            rows={6}
            className="bg-surface-container-lowest border border-outline-variant/20 focus:border-primary focus:ring-0 text-on-surface py-3 px-3 rounded-lg font-mono text-xs resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onApply}
              disabled={!jsonText.trim()}
              className={[
                'px-4 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors',
                jsonText.trim()
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'bg-surface-container-high text-outline-variant/50 cursor-not-allowed'
              ].join(' ')}
            >
              Apply
            </button>
            {feedback ? (
              <span
                className={[
                  'text-xs font-label',
                  feedback.kind === 'error' ? 'text-error' : 'text-on-surface-variant'
                ].join(' ')}
              >
                {feedback.message}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
