import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { HelpLauncher } from './HelpLauncher';

describe('HelpLauncher', () => {
  it('renders the first-run pointer dialog when the nudge is visible', () => {
    const html = renderToStaticMarkup(
      <HelpLauncher
        active={false}
        showNudge={true}
        onLaunch={vi.fn()}
      />
    );

    expect(html).toContain('data-help-indicator="true"');
    expect(html).toContain('Tour available');
    expect(html).not.toContain('Guided tour introduction');
  });
});
