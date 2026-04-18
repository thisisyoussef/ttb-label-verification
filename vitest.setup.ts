/**
 * Vitest global setup — polyfills browser APIs missing in Node < 20.
 *
 * Node 20+ exposes File as a global (via undici). Node 18 does not.
 * Rather than forcing every test author to import it, we shim it once here.
 */
import { File as NodeFile } from 'node:buffer';
import { webcrypto } from 'node:crypto';

if (typeof globalThis.File === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).File = NodeFile;
}

// Client modules call `crypto.randomUUID()` directly (e.g.
// `src/client/batchWorkflowLive.ts`). Node 20+ exposes
// `globalThis.crypto` at the runtime level, but vitest worker VM
// contexts don't always inherit it — tests that hit those code paths
// fail with `ReferenceError: crypto is not defined` without a shim.
// `node:crypto.webcrypto` is API-compatible with the browser's Web
// Crypto.
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto;
}

// Default OCR pre-pass to disabled in tests — Tesseract may not be available
// and tests should not depend on external system binaries. Tests that
// specifically exercise the OCR pre-pass can set OCR_PREPASS=enabled.
if (!process.env.OCR_PREPASS) {
  process.env.OCR_PREPASS = 'disabled';
}
