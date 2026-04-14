import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LOCAL_HELP_MANIFEST } from '../shared/help-fixture';
import { GuidedTourSpotlight } from './GuidedTourSpotlight';

function processingStep() {
  const step = LOCAL_HELP_MANIFEST.tourSteps.find(
    (entry) => entry.anchorKey === 'processing'
  );

  if (!step) {
    throw new Error('Expected processing step in local help manifest.');
  }

  return step;
}

function processingStepPair() {
  return [processingStep(), { ...processingStep(), stepIndex: 5, title: 'Follow-up step' }];
}

describe('GuidedTourSpotlight', () => {
  it('renders Next as disabled when the current step is blocked on required action', () => {
    const html = renderToStaticMarkup(
      <GuidedTourSpotlight
        steps={processingStepPair()}
        currentIndex={0}
        onClose={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        nextDisabled={true}
        onAdvanceInteraction={vi.fn()}
        onFinish={vi.fn()}
        onShowMe={vi.fn()}
      />
    );

    expect(html).toContain('Complete the required action on the live surface');
    expect(html).toContain('cursor-not-allowed shadow-none');
  });

  it('keeps Next enabled on passive steps or completed action steps', () => {
    const html = renderToStaticMarkup(
      <GuidedTourSpotlight
        steps={processingStepPair()}
        currentIndex={0}
        onClose={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        nextDisabled={false}
        onAdvanceInteraction={vi.fn()}
        onFinish={vi.fn()}
        onShowMe={vi.fn()}
      />
    );

    expect(html).toContain('Use the recovery action below or continue to the next step.');
    expect(html).not.toContain('cursor-not-allowed shadow-none');
  });
});
