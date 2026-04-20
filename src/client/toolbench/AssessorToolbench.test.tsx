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
    hasOpenedOnce: true,
  }),
}));

describe('AssessorToolbench', () => {
  it('renders a viewport-capped panel with a full-height scroll region', () => {
    const html = renderToStaticMarkup(
      <AssessorToolbench
        onLoadSample={vi.fn()}
        onLoadImage={vi.fn()}
        onLoadCsv={vi.fn()}
        mode="single"
        extractionMode="local"
        onReset={vi.fn()}
        onSwitchMode={vi.fn()}
        onToggleExtraction={vi.fn()}
        onLaunchTour={vi.fn()}
        tourActive={false}
      />
    );

    expect(html).toContain('h-[min(520px,calc(100vh-96px))]');
    expect(html).toContain('role="tabpanel" class="flex-1 min-h-0 overflow-y-auto"');
  });

  it('keeps the toolbench collapsed while the guided tour is active', () => {
    const html = renderToStaticMarkup(
      <AssessorToolbench
        onLoadSample={vi.fn()}
        onLoadImage={vi.fn()}
        onLoadCsv={vi.fn()}
        mode="single"
        extractionMode="local"
        onReset={vi.fn()}
        onSwitchMode={vi.fn()}
        onToggleExtraction={vi.fn()}
        onLaunchTour={vi.fn()}
        tourActive={true}
      />
    );

    expect(html).not.toContain('Assessor Toolbench');
    expect(html).toContain('disabled=""');
    expect(html).toContain('Close the guided tour to reopen the toolbench.');
  });
});
