import { z } from 'zod';

export const HELP_ANCHOR_KEYS = [
  'orientation',
  'intake-form',
  'processing',
  'verdict-and-checklist',
  'warning-evidence',
  'standalone-mode',
  'batch-matching-logic',
  'batch-matching',
  'no-persistence',
  'confidence-indicator'
] as const;

export const TOUR_TARGET_KEYS = [
  'tour-launcher',
  'tour-mode-toggle',
  'tour-drop-zone',
  'tour-verify-button',
  'tour-verdict-banner',
  'tour-warning-row',
  'tour-batch-tab',
  'tour-batch-intake',
  'tour-privacy-anchor'
] as const;

export const helpAnchorKeySchema = z.enum(HELP_ANCHOR_KEYS);
export const tourTargetKeySchema = z.enum(TOUR_TARGET_KEYS);
export const helpShowMeActionSchema = z.enum([
  'noop',
  'load-scenario',
  'advance-view',
  'open-panel-section'
]);

export const helpShowMeSchema = z.object({
  label: z.string().min(1),
  action: helpShowMeActionSchema,
  payload: z.record(z.string(), z.string()).optional()
});

export const tourStepRequiresSchema = z.object({
  scenarioId: z.string().optional(),
  expandRowId: z.string().optional(),
  variant: z.enum(['auto', 'standalone']).optional(),
  view: z.enum(['intake', 'results', 'batch-intake']).optional(),
  mode: z.enum(['single', 'batch']).optional()
});

export const tourStepSchema = z
  .object({
    anchorKey: helpAnchorKeySchema,
    stepIndex: z.number().int().positive(),
    totalSteps: z.number().int().positive(),
    title: z.string().min(1),
    body: z.string().min(1),
    target: tourTargetKeySchema.optional(),
    interaction: z.enum(['passive', 'click-to-advance']).optional(),
    requires: tourStepRequiresSchema.optional(),
    showMe: helpShowMeSchema.optional(),
    cta: z.string().min(1).optional()
  })
  .superRefine((step, context) => {
    if (step.stepIndex > step.totalSteps) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stepIndex'],
        message: 'stepIndex cannot exceed totalSteps.'
      });
    }
  });

export const infoPopoverSchema = z.object({
  anchorKey: helpAnchorKeySchema,
  title: z.string().min(1),
  body: z.string().min(1)
});

export const helpManifestSchema = z.object({
  version: z.number().int().positive(),
  locale: z.literal('en'),
  tourSteps: z.array(tourStepSchema).min(1),
  infoPopovers: z.array(infoPopoverSchema).min(1)
});

export type HelpAnchorKey = z.infer<typeof helpAnchorKeySchema>;
export type TourTargetKey = z.infer<typeof tourTargetKeySchema>;
export type HelpShowMeAction = z.infer<typeof helpShowMeActionSchema>;
export type HelpShowMe = z.infer<typeof helpShowMeSchema>;
export type TourStepRequires = z.infer<typeof tourStepRequiresSchema>;
export type TourStep = z.infer<typeof tourStepSchema>;
export type InfoPopover = z.infer<typeof infoPopoverSchema>;
export type HelpManifest = z.infer<typeof helpManifestSchema>;
