import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FAILURE_MESSAGE,
  GENERIC_FAILURE_MESSAGE,
  resolveReviewFailureMessage
} from './reviewFailureMessage';

describe('review failure message helpers', () => {
  it('keeps specific backend messages unchanged', () => {
    expect(
      resolveReviewFailureMessage(
        'We could not reach the extraction service right now.',
        'extracting-fields'
      )
    ).toBe('We could not reach the extraction service right now.');
  });

  it('maps the connection-dropped fallback to the failed processing step', () => {
    expect(
      resolveReviewFailureMessage(DEFAULT_FAILURE_MESSAGE, 'extracting-fields')
    ).toBe(
      'The connection dropped while identifying label fields. Your label and inputs are still here — nothing was saved.'
    );
  });

  it('maps the generic fallback to the failed processing step', () => {
    expect(
      resolveReviewFailureMessage(GENERIC_FAILURE_MESSAGE, 'running-checks')
    ).toBe(
      'We could not finish while running compliance checks. Your label and inputs are still here — nothing was saved.'
    );
  });

  it('falls back to the default reading-label copy when no step is available', () => {
    expect(resolveReviewFailureMessage(DEFAULT_FAILURE_MESSAGE, null)).toBe(
      DEFAULT_FAILURE_MESSAGE
    );
  });
});
