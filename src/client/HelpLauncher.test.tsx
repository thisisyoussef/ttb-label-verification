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
        onDismissNudge={vi.fn()}
      />
    );

    expect(html).toContain('Guided tour introduction');
    expect(html).toContain('How this works');
    expect(html).toContain('Take the tour');
  });
});
