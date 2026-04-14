import type { ProcessingStepId } from './types';

const PERSISTENCE_REASSURANCE =
  'Your label and inputs are still here — nothing was saved.';

const STEP_COPY: Record<
  ProcessingStepId,
  { connectionDropped: string; generic: string }
> = {
  'reading-image': {
    connectionDropped: 'The connection dropped while reading the label.',
    generic: 'We could not finish while reading the label.'
  },
  'extracting-fields': {
    connectionDropped: 'The connection dropped while extracting structured fields.',
    generic: 'We could not finish while extracting structured fields.'
  },
  'detecting-beverage': {
    connectionDropped: 'The connection dropped while detecting the beverage type.',
    generic: 'We could not finish while detecting the beverage type.'
  },
  'running-checks': {
    connectionDropped: 'The connection dropped while running deterministic checks.',
    generic: 'We could not finish while running deterministic checks.'
  },
  'preparing-evidence': {
    connectionDropped: 'The connection dropped while preparing the evidence.',
    generic: 'We could not finish while preparing the evidence.'
  }
};

export const DEFAULT_FAILURE_MESSAGE = `${STEP_COPY['reading-image'].connectionDropped} ${PERSISTENCE_REASSURANCE}`;
export const GENERIC_FAILURE_MESSAGE = `We could not finish this review. ${PERSISTENCE_REASSURANCE}`;

function withReassurance(message: string) {
  return `${message} ${PERSISTENCE_REASSURANCE}`;
}

export function resolveReviewFailureMessage(
  message: string,
  stepId: ProcessingStepId | null
) {
  if (!stepId) {
    return message;
  }

  if (message === DEFAULT_FAILURE_MESSAGE) {
    return withReassurance(STEP_COPY[stepId].connectionDropped);
  }

  if (message === GENERIC_FAILURE_MESSAGE) {
    return withReassurance(STEP_COPY[stepId].generic);
  }

  return message;
}
