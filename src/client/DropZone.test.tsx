import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DropZone, resolveNextImages } from './DropZone';
import type { LabelImage } from './types';

function makeImage(name: string): LabelImage {
  return {
    file: new File(['demo'], name, { type: 'image/png' }),
    previewUrl: `data:image/png;base64,${name}`,
    sizeLabel: '1 KB'
  };
}

describe('DropZone', () => {
  it('keeps the tour target on the unified upload surface', () => {
    const html = renderToStaticMarkup(
      <DropZone
        primaryImage={null}
        secondaryImage={null}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain('data-tour-target="tour-drop-zone"');
    expect(html).toContain('Choose the main label image');
    expect(html).toContain('Add second image');
  });

  it('renders both slots inside the same component when images are loaded', () => {
    const html = renderToStaticMarkup(
      <DropZone
        primaryImage={makeImage('front.png')}
        secondaryImage={makeImage('back.png')}
        onChange={vi.fn()}
      />
    );

    expect(html).toContain('front.png');
    expect(html).toContain('back.png');
    expect(html).toContain('data-tour-target="tour-drop-zone"');
    expect(html).toContain('data-tour-target="tour-secondary-drop-zone"');
  });

  it('fills primary and secondary in order on a bulk two-file selection', () => {
    const result = resolveNextImages({
      target: 'bulk',
      nextImages: [makeImage('front.png'), makeImage('back.png')],
      primaryImage: null,
      secondaryImage: null
    });

    expect(result.primaryImage?.file.name).toBe('front.png');
    expect(result.secondaryImage?.file.name).toBe('back.png');
  });

  it('keeps the current primary when the second slot is updated', () => {
    const result = resolveNextImages({
      target: 'secondary',
      nextImages: [makeImage('new-back.png')],
      primaryImage: makeImage('front.png'),
      secondaryImage: null
    });

    expect(result.primaryImage?.file.name).toBe('front.png');
    expect(result.secondaryImage?.file.name).toBe('new-back.png');
  });
});
