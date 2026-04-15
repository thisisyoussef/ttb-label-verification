import {
  TOOLBENCH_BATCH_SCENARIOS,
  TOOLBENCH_SINGLE_SCENARIOS,
  type ToolbenchSingleScenario,
} from './toolbenchFixtures';

interface ToolbenchScenariosProps {
  activeScenarioId: string;
  activeBatchSeedId: string;
  onSelectScenario: (scenario: ToolbenchSingleScenario) => void;
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
    <div className="flex flex-col gap-4 p-3">
      <section className="flex flex-col gap-1">
        <p className={SECTION_HEADER}>Single Review</p>
        {TOOLBENCH_SINGLE_SCENARIOS.map((scenario) => {
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
        {TOOLBENCH_BATCH_SCENARIOS.map((scenario) => {
          const isActive = scenario.id === activeBatchSeedId;
          return (
            <button
              key={scenario.id}
              onClick={() => onSelectBatchSeed(scenario.id)}
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
    </div>
  );
}
