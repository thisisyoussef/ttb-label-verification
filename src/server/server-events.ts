// Server-side structured event logger.
//
// Mirrors the client-side `logReviewClientEvent` pattern but emits to the
// server console so operators / QA can see cross-mode fallback transitions
// and other provider-routing decisions.
//
// In tests we suppress output to avoid noisy CI logs. In all other cases we
// emit a single JSON line keyed by `type` so logs are grep-friendly.

export type ServerEventPayload = Record<string, unknown>;

export function logServerEvent(type: string, payload: ServerEventPayload = {}) {
  if (process.env.NODE_ENV === 'test' && process.env.TTB_LOG_SERVER_EVENTS !== '1') {
    return;
  }

  const record = {
    type,
    timestamp: new Date().toISOString(),
    ...payload
  };

  // eslint-disable-next-line no-console
  console.log(`[ttb.server.event] ${JSON.stringify(record)}`);
}
