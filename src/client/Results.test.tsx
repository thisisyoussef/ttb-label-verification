import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { seedVerificationReport } from '../shared/contracts/review-seed';
import { Results } from './Results';

const image = {
  file: new File(['demo'], 'spirit-warning-errors.png', { type: 'image/png' }),
  previewUrl: 'data:image/png;base64,AAA=',
  sizeLabel: '1 KB'
};

const secondaryImage = {
  file: new File(['demo'], 'spirit-warning-errors-back.png', { type: 'image/png' }),
  previewUrl: 'data:image/png;base64,BBB=',
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
    expect(html).toContain('Warning text is present');
    expect(html).toContain('Warning heading is uppercase and bold');
    expect(html).toContain('Warning is legible at label size');
    expect(html).toContain('Text comparison');
    expect(html).toContain('Required warning');
    expect(html).toContain('Read from label');
    expect(html).toContain('Government Warning');
    expect(html).toContain('data-tour-target="tour-warning-row"');
  });

  it('shows a dual-image gallery when a second label image is present', () => {
    const html = renderToStaticMarkup(
      <Results
        image={image}
        secondaryImage={secondaryImage}
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

    expect(html).toContain('2 images attached');
    expect(html).toContain('spirit-warning-errors.png');
    expect(html).toContain('spirit-warning-errors-back.png');
    expect(html).toContain('Expand');
  });
});
