import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LabelEvidenceBadge } from './LabelEvidenceBadge';

describe('LabelEvidenceBadge', () => {
  it('renders nothing when only one image was submitted', () => {
    const html = renderToStaticMarkup(
      <LabelEvidenceBadge evidenceImage={0} totalImages={1} />
    );
    expect(html).toBe('');
  });

  it('renders nothing when evidenceImage is null (value spans images)', () => {
    const html = renderToStaticMarkup(
      <LabelEvidenceBadge evidenceImage={null} totalImages={2} />
    );
    expect(html).toBe('');
  });

  it('renders "Image 1" for the first-uploaded image (0-indexed ordinal)', () => {
    const html = renderToStaticMarkup(
      <LabelEvidenceBadge evidenceImage={0} totalImages={2} />
    );
    expect(html).toContain('Image 1');
    expect(html).toContain('Read from label image 1 of 2');
  });

  it('renders "Image 2" for the second-uploaded image', () => {
    const html = renderToStaticMarkup(
      <LabelEvidenceBadge evidenceImage={1} totalImages={2} />
    );
    expect(html).toContain('Image 2');
  });

  it('rejects negative ordinals defensively', () => {
    const html = renderToStaticMarkup(
      <LabelEvidenceBadge evidenceImage={-1} totalImages={2} />
    );
    expect(html).toBe('');
  });
});
