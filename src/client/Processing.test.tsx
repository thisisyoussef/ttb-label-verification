import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { Processing } from './Processing';
import type { ProcessingStep } from './types';

const image = {
  file: new File(['demo'], 'live-front.png', { type: 'image/png' }),
  previewUrl: 'data:image/png;base64,AAA=',
  sizeLabel: '1 KB'
};

const secondaryImage = {
  file: new File(['demo'], 'live-back.png', { type: 'image/png' }),
  previewUrl: 'data:image/png;base64,BBB=',
  sizeLabel: '1 KB'
};

const steps: ProcessingStep[] = [
  { id: 'reading-image', label: 'Reading label image', status: 'active' },
  { id: 'extracting-fields', label: 'Identifying label fields', status: 'pending' },
  { id: 'detecting-beverage', label: 'Detecting beverage type', status: 'pending' },
  { id: 'running-checks', label: 'Running compliance checks', status: 'pending' },
  { id: 'preparing-evidence', label: 'Preparing evidence', status: 'pending' }
];

describe('Processing', () => {
  it('shows a dual-image gallery when a second label image is present', () => {
    // Regression guard: AppShell used to drop secondaryImage on the
    // Processing render site so the reviewer sidebar always said
    // "1 image attached" even when two images had been loaded at
    // intake. This test locks in that a secondary image reaches the
    // gallery and the file list.
    const html = renderToStaticMarkup(
      <Processing
        image={image}
        secondaryImage={secondaryImage}
        beverage="auto"
        steps={steps}
        phase="running"
        failureMessage=""
        localUnavailable={false}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onBackToIntake={vi.fn()}
        onSwitchToCloud={vi.fn()}
      />
    );

    expect(html).toContain('2 images attached');
    expect(html).toContain('live-front.png');
    expect(html).toContain('live-back.png');
    expect(html).toContain('Secondary file');
  });

  it('falls back to a single-image layout when no secondary is provided', () => {
    const html = renderToStaticMarkup(
      <Processing
        image={image}
        beverage="auto"
        steps={steps}
        phase="running"
        failureMessage=""
        localUnavailable={false}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onBackToIntake={vi.fn()}
        onSwitchToCloud={vi.fn()}
      />
    );

    expect(html).toContain('1 image attached');
    expect(html).toContain('live-front.png');
    expect(html).not.toContain('Secondary file');
  });
});
