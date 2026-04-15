import { seedScenarios, type SeedScenario } from '../scenarios';
import { SEED_BATCHES } from '../batchScenarios';

interface ToolbenchScenariosProps {
  activeScenarioId: string;
  activeBatchSeedId: string;
  onSelectScenario: (scenario: SeedScenario) => void;
  onSelectBatchSeed: (id: string) => void;
}

const SECTION_HEADER = 'font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant';
const SCENARIO_BASE = 'w-full text-left rounded px-2 py-1.5 transition-colors';
const SCENARIO_ACTIVE = 'bg-primary/10 text-primary';
const SCENARIO_IDLE = 'text-on-surface hover:bg-surface-container-high';

export function ToolbenchScenarios({
  activeScenarioId,
  activeBatchSeedId,
  onSelectScenario,
  onSelectBatchSeed,
}: ToolbenchScenariosProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-3">
      <section className="flex flex-col gap-1">
        <p className={SECTION_HEADER}>Single Review</p>
        {seedScenarios.map((scenario) => {
          const isActive = scenario.id === activeScenarioId;
          return (
            <button
              key={scenario.id}
              onClick={() => onSelectScenario(scenario)}
              className={`${SCENARIO_BASE} ${isActive ? SCENARIO_ACTIVE : SCENARIO_IDLE}`}
            >
              <p className="text-xs font-body font-semibold leading-tight">{scenario.title}</p>
              <p className="text-[10px] font-body text-on-surface-variant leading-tight mt-0.5">
                {scenario.description}
              </p>
            </button>
          );
        })}
      </section>

      <section className="flex flex-col gap-1">
        <p className={SECTION_HEADER}>Batch</p>
        {SEED_BATCHES.map((batch) => {
          const isActive = batch.id === activeBatchSeedId;
          return (
            <button
              key={batch.id}
              onClick={() => onSelectBatchSeed(batch.id)}
              className={`${SCENARIO_BASE} ${isActive ? SCENARIO_ACTIVE : SCENARIO_IDLE}`}
            >
              <p className="text-xs font-body font-semibold leading-tight">{batch.label}</p>
              <p className="text-[10px] font-body text-on-surface-variant leading-tight mt-0.5">
                {batch.description}
              </p>
            </button>
          );
        })}
      </section>
    </div>
  );
}
