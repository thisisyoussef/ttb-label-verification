import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LOCAL_HELP_MANIFEST } from '../shared/help-fixture';
import { GuidedTourSpotlight } from './GuidedTourSpotlight';

vi.mock('./useGuidedTourSpotlightTarget', () => ({
  useGuidedTourSpotlightTarget: vi.fn(() => ({
    rect: {
      top: 640,
      left: 980,
      width: 220,
      height: 56
    },
    highlightVisible: true
  }))
}));

function processingStepPair() {
  const step = LOCAL_HELP_MANIFEST.tourSteps.find(
    (entry) => entry.anchorKey === 'processing'
  );

  if (!step) {
    throw new Error('Expected processing step in local help manifest.');
  }

  return [step, { ...step, stepIndex: 5, title: 'Follow-up step' }];
}

describe('GuidedTourSpotlight mask', () => {
  it('renders bounded mask segments around the target instead of a clip-path cutout', () => {
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
        onShowMeAndContinue={vi.fn()}
      />
    );

    expect(html).not.toContain('clip-path');
    expect(html).toContain('top:0;left:0;right:0;height:640px');
    expect(html).toContain('top:640px;left:0;width:980px;height:56px');
    expect(html).toContain('top:640px;left:1200px;right:0;height:56px');
    expect(html).toContain('top:696px;left:0;right:0;bottom:0');
  });
});
