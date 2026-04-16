/**
 * Vitest global setup — polyfills browser APIs missing in Node < 20.
 *
 * Node 20+ exposes File as a global (via undici). Node 18 does not.
 * Rather than forcing every test author to import it, we shim it once here.
 */
import { File as NodeFile } from 'node:buffer';

if (typeof globalThis.File === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).File = NodeFile;
}

// Default OCR pre-pass to disabled in tests — Tesseract may not be available
// and tests should not depend on external system binaries. Tests that
// specifically exercise the OCR pre-pass can set OCR_PREPASS=enabled.
if (!process.env.OCR_PREPASS) {
  process.env.OCR_PREPASS = 'disabled';
}
