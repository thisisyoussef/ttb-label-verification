import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { seedVerificationReport } from '../shared/contracts/review-seed';
import { Results } from './Results';

const image = {
  file: new File(['demo'], 'spirit-warning-errors.png', { type: 'image/png' }),
  previewUrl: 'data:image/png;base64,AAA=',
  sizeLabel: '1 KB'
};

describe('Results', () => {
  it('renders warning evidence closed by default', () => {
    const html = renderToStaticMarkup(
      <Results
        image={image}
        beverage="distilled-spirits"
        report={seedVerificationReport}
        onNewReview={vi.fn()}
        onRunFullComparison={vi.fn()}
        onTryAnotherImage={vi.fn()}
        onContinueWithCaution={vi.fn()}
        onExportResults={vi.fn()}
        exportEnabled={true}
      />
    );

    expect(html).not.toContain('Sub-checks');
    expect(html).not.toContain('Text comparison');
    expect(html).not.toContain('data-tour-target="tour-warning-row"');
  });

  it('expands the requested row when the tour asks for warning evidence', () => {
    const html = renderToStaticMarkup(
      <Results
        image={image}
        beverage="distilled-spirits"
        report={seedVerificationReport}
        tourExpandedCheckId="government-warning"
        onNewReview={vi.fn()}
        onRunFullComparison={vi.fn()}
        onTryAnotherImage={vi.fn()}
        onContinueWithCaution={vi.fn()}
        onExportResults={vi.fn()}
        exportEnabled={true}
      />
    );

    expect(html).toContain('Sub-checks');
    expect(html).toContain('Text comparison');
    expect(html).toContain('data-tour-target="tour-warning-row"');
  });
});
