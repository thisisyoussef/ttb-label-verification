const reviewTraceEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_REVIEW_TRACE === 'true';

export function logReviewClientEvent(
  event: string,
  payload: Record<string, unknown>
) {
  if (!reviewTraceEnabled) {
    return;
  }

  console.info('[review-trace][client]', {
    event,
    ...payload
  });
}
