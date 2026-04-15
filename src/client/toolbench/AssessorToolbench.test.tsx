import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AssessorToolbench } from './AssessorToolbench';

vi.mock('./useToolbenchState', () => ({
  useToolbenchState: () => ({
    open: true,
    tab: 'assets',
    setTab: vi.fn(),
    toggle: vi.fn(),
    close: vi.fn(),
  }),
}));

describe('AssessorToolbench', () => {
  it('renders a viewport-capped panel with a full-height scroll region', () => {
    const html = renderToStaticMarkup(
      <AssessorToolbench
        activeScenarioId="blank"
        activeBatchSeedId="seed-mixed-blockers"
        onSelectScenario={vi.fn()}
        onSelectBatchSeed={vi.fn()}
        onLoadImage={vi.fn()}
        onLoadCsv={vi.fn()}
        mode="single"
        extractionMode="local"
        onReset={vi.fn()}
        onSwitchMode={vi.fn()}
        onToggleExtraction={vi.fn()}
        onLaunchTour={vi.fn()}
      />
    );

    expect(html).toContain('h-[min(520px,calc(100vh-96px))]');
    expect(html).toContain('role="tabpanel" class="flex h-full flex-1 min-h-0 overflow-hidden"');
    expect(html).toContain('flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-3');
  });
});
