import { seedScenarios, type SeedScenario } from '../scenarios';
import { SEED_BATCHES } from '../batch/batchScenarios';

export type ToolbenchSingleScenario = SeedScenario;

export interface ToolbenchBatchScenario {
  id: string;
  title: string;
  description: string;
}

export const TOOLBENCH_SINGLE_SCENARIOS: ToolbenchSingleScenario[] = seedScenarios;

export const TOOLBENCH_BATCH_SCENARIOS: ToolbenchBatchScenario[] = SEED_BATCHES.map(
  (batch) => ({
    id: batch.id,
    title: batch.label,
    description: batch.description,
  })
);
