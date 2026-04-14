import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DropZone } from './DropZone';

describe('DropZone', () => {
  it('keeps the tour target on the empty upload state', () => {
    const html = renderToStaticMarkup(
      <DropZone image={null} onAccept={vi.fn()} onRemove={vi.fn()} />
    );

    expect(html).toContain('data-tour-target="tour-drop-zone"');
  });

  it('keeps the tour target on the loaded upload state', () => {
    const image = {
      file: new File(['demo'], 'perfect-spirit-label.png', { type: 'image/png' }),
      previewUrl: 'data:image/png;base64,AAA=',
      sizeLabel: '1 KB'
    };

    const html = renderToStaticMarkup(
      <DropZone image={image} onAccept={vi.fn()} onRemove={vi.fn()} />
    );

    expect(html).toContain('data-tour-target="tour-drop-zone"');
  });
});
