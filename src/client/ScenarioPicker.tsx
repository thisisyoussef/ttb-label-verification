import { seedScenarios } from './scenarios';
import type { SeedScenario } from './scenarios';

interface ScenarioPickerProps {
  scenarioId: string;
  onSelect: (scenario: SeedScenario) => void;
}

export function ScenarioPicker({ scenarioId, onSelect }: ScenarioPickerProps) {
  return (
    <label className="flex items-center gap-2 text-xs font-label text-on-surface-variant">
      <span className="uppercase tracking-widest font-bold">Seed scenario</span>
      <select
        value={scenarioId}
        onChange={(event) => {
          const next = seedScenarios.find((scenario) => scenario.id === event.target.value);
          if (next) onSelect(next);
        }}
        className="bg-surface-container-lowest border border-outline-variant/30 rounded px-2 py-1 text-xs font-body text-on-surface focus:ring-0 focus:border-primary"
      >
        {seedScenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.title}
          </option>
        ))}
      </select>
    </label>
  );
}
