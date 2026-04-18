import { z } from 'zod';

import { beverageTypeSchema, verdictSchema } from './review-base';

/**
 * Contract for the toolbench "Generate sample with Gemini" button.
 *
 * The server runs Imagen 4 with a structured prompt, builds matching
 * declared fields, and may inject one of several intentional defects
 * so the verification pipeline's reject/review paths get exercised
 * from a sample load.
 *
 * The image bytes are not inlined in the response — they're cached
 * server-side and served by `GET /api/eval/synthetic/image/:id`. The
 * client fetches the URL just like it does for `/api/eval/sample`.
 */

export const SYNTHETIC_LABEL_DEFECT_KINDS = [
  'none',
  'abv-mismatch',
  'warning-missing',
  'brand-different',
  'country-wrong-import',
  'class-totally-different'
] as const;

export const syntheticLabelDefectKindSchema = z.enum(
  SYNTHETIC_LABEL_DEFECT_KINDS
);

export const syntheticLabelExpectedSchema = z.object({
  /** What the verification pipeline should produce on a clean run. */
  verdict: verdictSchema,
  /** Which defect (if any) was injected when generating this label. */
  defectKind: syntheticLabelDefectKindSchema,
  /**
   * Human-readable description of the defect — shown as a chip in the
   * toolbench so the dev knows what to expect before clicking Verify.
   */
  description: z.string()
});

export const syntheticLabelImageSchema = z.object({
  id: z.string().min(1),
  /** GET this URL to retrieve the cached image bytes. */
  url: z.string().min(1),
  filename: z.string().min(1),
  beverageType: beverageTypeSchema
});

export const syntheticLabelFieldsSchema = z.object({
  brandName: z.string(),
  fancifulName: z.string(),
  classType: z.string(),
  alcoholContent: z.string(),
  netContents: z.string(),
  applicantAddress: z.string(),
  origin: z.enum(['domestic', 'imported']),
  country: z.string(),
  formulaId: z.string(),
  appellation: z.string(),
  vintage: z.string()
});

export const syntheticLabelGenerateResponseSchema = z.object({
  image: syntheticLabelImageSchema,
  fields: syntheticLabelFieldsSchema,
  expected: syntheticLabelExpectedSchema
});

export const syntheticLabelStatusSchema = z.object({
  available: z.boolean(),
  /** Imagen model identifier when available, omitted otherwise. */
  model: z.string().optional()
});

export type SyntheticLabelDefectKind = z.infer<
  typeof syntheticLabelDefectKindSchema
>;
export type SyntheticLabelExpected = z.infer<
  typeof syntheticLabelExpectedSchema
>;
export type SyntheticLabelImage = z.infer<typeof syntheticLabelImageSchema>;
export type SyntheticLabelFields = z.infer<typeof syntheticLabelFieldsSchema>;
export type SyntheticLabelGenerateResponse = z.infer<
  typeof syntheticLabelGenerateResponseSchema
>;
export type SyntheticLabelStatus = z.infer<typeof syntheticLabelStatusSchema>;
