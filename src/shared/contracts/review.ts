import { z } from 'zod';

export const verificationStatusSchema = z.enum(['pass', 'review', 'fail', 'info']);
export const severitySchema = z.enum(['blocker', 'major', 'minor', 'note']);
export const beverageTypeSchema = z.enum([
  'distilled-spirits',
  'wine',
  'malt-beverage',
  'unknown'
]);
export const recommendationSchema = z.enum(['approve', 'review', 'reject']);

export const fieldReviewSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: verificationStatusSchema,
  severity: severitySchema,
  summary: z.string(),
  details: z.string().optional(),
  confidence: z.number().min(0).max(1),
  citations: z.array(z.string()).default([])
});

export const verificationReportSchema = z.object({
  id: z.string(),
  mode: z.enum(['single-label', 'batch']),
  beverageType: beverageTypeSchema,
  overallStatus: verificationStatusSchema,
  recommendation: recommendationSchema,
  latencyBudgetMs: z.number().int().positive().max(5000),
  noPersistence: z.literal(true),
  summary: z.string(),
  checks: z.array(fieldReviewSchema).min(1)
});

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('ttb-label-verification'),
  mode: z.literal('scaffold'),
  responsesApi: z.literal(true),
  store: z.literal(false),
  timestamp: z.string().datetime()
});

export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type BeverageType = z.infer<typeof beverageTypeSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type FieldReview = z.infer<typeof fieldReviewSchema>;
export type VerificationReport = z.infer<typeof verificationReportSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const seedVerificationReport: VerificationReport = {
  id: 'seed-distilled-spirits-001',
  mode: 'single-label',
  beverageType: 'distilled-spirits',
  overallStatus: 'review',
  recommendation: 'review',
  latencyBudgetMs: 5000,
  noPersistence: true,
  summary:
    'Scaffold result only. The current flow demonstrates the shared contract, severity mapping, and no-persistence guardrails before live extraction is wired.',
  checks: [
    {
      id: 'brand-name',
      label: 'Brand name',
      status: 'pass',
      severity: 'note',
      summary: 'Seed fixture includes a brand name match.',
      details:
        'This row exists to anchor the UI contract. Real validation will compare extracted label text against application data.',
      confidence: 0.99,
      citations: ['TTB distilled spirits mandatory label information']
    },
    {
      id: 'same-field-of-vision',
      label: 'Same field of vision',
      status: 'review',
      severity: 'major',
      summary:
        'Spatial verification remains a review state until the extraction layer can localize brand name, class/type, and alcohol content reliably.',
      details:
        'Per TTB guidance, brand name, class/type, and alcohol content must appear in the same field of vision. The scaffold treats uncertainty as review.',
      confidence: 0.54,
      citations: [
        'TTB distilled spirits mandatory label information',
        '27 CFR 5.61 and related TTB guidance'
      ]
    },
    {
      id: 'government-warning',
      label: 'Government warning',
      status: 'review',
      severity: 'blocker',
      summary:
        'The warning statement is modeled as a blocker-class check because exact text and formatting are rejection-critical.',
      details:
        'The next slice will harden this into deterministic sub-checks for presence, exact text, uppercase bold prefix, continuous paragraph formatting, and legibility.',
      confidence: 0.62,
      citations: [
        'TTB distilled spirits health warning guidance',
        '27 CFR part 16'
      ]
    }
  ]
};

export function getSeedVerificationReport(): VerificationReport {
  return verificationReportSchema.parse(seedVerificationReport);
}
