import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';

import type { NormalizedUploadedLabel } from './review-intake';

/**
 * VLM check for the spirits "same field of vision" rule
 * (27 CFR 5.61, TTB distilled-spirits guidance): brand name,
 * class/type designation, and alcohol content must all appear on
 * the same primary panel of a distilled-spirits label.
 *
 * The main extraction pipeline already extracts each field's text
 * but doesn't track which physical panel of the label each field
 * appears on. This module fires a focused VLM call (a single
 * structured-JSON question) so the report builder can render a
 * real check row instead of the "please confirm by eye" placeholder
 * that was shipped earlier.
 *
 * Cost: ~one extra Gemini Flash-Lite vision call per spirits review
 * (~2-4s). Returns null when GEMINI_API_KEY isn't set so deploys
 * without a key still work — the report falls back to the
 * placeholder check.
 */

const COLOCATION_MODEL =
  process.env.SPIRITS_COLOCATION_MODEL?.trim() ||
  process.env.GEMINI_VISION_MODEL?.trim() ||
  'gemini-2.5-flash-lite';

const COLOCATION_TIMEOUT_MS = Number(
  process.env.SPIRITS_COLOCATION_TIMEOUT_MS ?? 8000
);

const PROMPT = `You are checking a US TTB distilled-spirits label image for a single
regulatory rule (27 CFR 5.61): the brand name, the class/type
designation (e.g. "Kentucky Straight Bourbon Whiskey", "Vodka",
"Gin"), and the alcohol content statement (e.g. "40% Alc./Vol.")
MUST all appear together on the SAME primary panel of the label.

Look at the label image and answer:

1. Identify the primary panel (the front-facing panel a consumer
   sees first, typically dominated by the brand mark).
2. Decide which of the three required pieces appear on that primary
   panel and which (if any) only appear on a different panel.

Respond ONLY with strict JSON in this exact shape:
{
  "colocated": true | false,
  "primaryPanelDescription": "short phrase describing the primary panel",
  "missingFromPrimary": ["brand-name" | "class-type" | "alcohol-content", ...],
  "confidence": 0.0-1.0,
  "reason": "one short sentence explaining the decision"
}

Rules:
- "colocated" is true ONLY when ALL three pieces appear on the
  primary panel.
- "missingFromPrimary" lists ONLY pieces that appear elsewhere on
  the label or are not visible at all. Empty array when colocated.
- Use lowercase identifiers exactly as listed.
- Confidence reflects how sure you are about each piece's panel
  assignment, not how certain you are about the underlying text.
- Do not output any text outside the JSON object.`;

export type SpiritsColocationMissing =
  | 'brand-name'
  | 'class-type'
  | 'alcohol-content';

export interface SpiritsColocationResult {
  colocated: boolean;
  primaryPanelDescription: string;
  missingFromPrimary: SpiritsColocationMissing[];
  confidence: number;
  reason: string;
}

export interface SpiritsColocationDeps {
  /** Override the VLM call (used by tests). */
  callVlm?: (prompt: string, image: NormalizedUploadedLabel) => Promise<string>;
}

export function isSpiritsColocationAvailable(): boolean {
  if (process.env.ENABLE_SPIRITS_COLOCATION === 'false') return false;
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function checkSpiritsColocation(
  label: NormalizedUploadedLabel,
  deps: SpiritsColocationDeps = {}
): Promise<SpiritsColocationResult | null> {
  const call = deps.callVlm ?? defaultCallVlm;
  let raw: string;
  try {
    raw = await call(PROMPT, label);
  } catch {
    return null;
  }
  return parseColocationResponse(raw);
}

async function defaultCallVlm(
  prompt: string,
  label: NormalizedUploadedLabel
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COLOCATION_TIMEOUT_MS);

  try {
    const response = (await ai.models.generateContent({
      model: COLOCATION_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: label.mimeType,
                data: label.buffer.toString('base64')
              }
            }
          ]
        }
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        abortSignal: controller.signal
      }
    })) as GenerateContentResponse;

    const text = response.text ?? '';
    if (!text) throw new Error('Empty VLM response.');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

const MISSING_VALUES: ReadonlySet<string> = new Set([
  'brand-name',
  'class-type',
  'alcohol-content'
]);

export function parseColocationResponse(
  raw: string
): SpiritsColocationResult | null {
  // Strip Markdown code fences the model occasionally emits even
  // with responseMimeType: application/json.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const colocated = obj.colocated;
  if (typeof colocated !== 'boolean') return null;
  const description = typeof obj.primaryPanelDescription === 'string'
    ? obj.primaryPanelDescription.trim().slice(0, 200)
    : '';
  const missing = Array.isArray(obj.missingFromPrimary)
    ? obj.missingFromPrimary
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry): entry is SpiritsColocationMissing =>
          MISSING_VALUES.has(entry)
        )
    : [];
  const confidence = clamp01(
    typeof obj.confidence === 'number' ? obj.confidence : 0.6
  );
  const reason = typeof obj.reason === 'string'
    ? obj.reason.trim().slice(0, 280)
    : '';
  // If the model claimed colocated=true but listed missing pieces,
  // trust the missing list — it's the more concrete signal.
  const effectiveColocated = colocated && missing.length === 0;
  return {
    colocated: effectiveColocated,
    primaryPanelDescription: description,
    missingFromPrimary: missing,
    confidence,
    reason
  };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0.6;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
