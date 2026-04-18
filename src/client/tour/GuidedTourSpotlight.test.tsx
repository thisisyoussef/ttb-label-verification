import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LOCAL_HELP_MANIFEST } from '../../shared/help-fixture';
import { GuidedTourSpotlight } from './GuidedTourSpotlight';
import { buildResultsAction } from './help-tour-actions';
import type { TourStep } from '../helpManifest';

function processingStep() {
  const step = LOCAL_HELP_MANIFEST.tourSteps.find(
    (entry) => entry.anchorKey === 'processing'
  );

  if (!step) {
    throw new Error('Expected processing step in local help manifest.');
  }

  return step;
}

function processingStepPair(): TourStep[] {
  return [processingStep(), { ...processingStep(), stepIndex: 5, title: 'Follow-up step' }];
}

function recoveryStepPair(): TourStep[] {
  return [
    {
      ...processingStep(),
      cta: 'Verification failed. Use Show sample results to continue the tour.',
      showMe: buildResultsAction('Show sample results', 'perfect-spirit-label')
    },
    { ...processingStep(), stepIndex: 5, title: 'Follow-up step' }
  ];
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
        onShowMeAndContinue={vi.fn()}
      />
    );

    expect(html).toContain('Complete the step above, then continue.');
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
        onShowMeAndContinue={vi.fn()}
      />
    );

    expect(html).toContain('You can skip ahead or use the button below.');
    expect(html).not.toContain('cursor-not-allowed shadow-none');
  });

  it('uses the footer recovery action instead of Next when recovery is the forward path', () => {
    const html = renderToStaticMarkup(
      <GuidedTourSpotlight
        steps={recoveryStepPair()}
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

    expect(html).toContain('Show sample results');
    expect(html).toContain('Use the button below to continue.');
    expect(html).not.toContain('>Next<');
  });
});
