import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ResultsPinnedColumn } from './ResultsPinnedColumn';

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

describe('ResultsPinnedColumn', () => {
  it('keeps the results left rail as one non-sticky scroll flow', () => {
    const html = renderToStaticMarkup(
      <ResultsPinnedColumn
        image={image}
        secondaryImage={secondaryImage}
        beverage="distilled-spirits"
      />
    );

    expect(html).toContain('Label details');
    expect(html).toContain('2 attached');
    expect(html).toContain('Nothing is stored');
    expect(html).not.toContain('sticky top-0');
  });
});
