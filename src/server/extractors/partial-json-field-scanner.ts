/**
 * Incremental scanner that extracts completed `fields.XXX: {...}`
 * subobjects from a streaming JSON buffer. Used by the Gemini
 * streaming path to emit vlm-field frames as soon as each field's
 * JSON value closes, without waiting for the full response.
 *
 * Scope is intentionally narrow: we only care about object-valued
 * entries under the top-level `fields` key, which is how the review-
 * extraction schema is shaped. Everything else in the stream is
 * ignored by this scanner — the final buffer is still fully parsed
 * by Zod at the end.
 *
 * Why not a real streaming JSON library (stream-json, jsonparse)?
 * This is a single-use scanner for one specific schema, and the
 * chunks arrive monotonically. A ~100-line brace-depth tracker is
 * both easier to reason about and has zero dependencies.
 */

export interface ScannedField {
  /** Field name as it appears in the stream, e.g. "brandName". */
  name: string;
  /** Parsed value (if the JSON fragment was well-formed). */
  value: unknown;
}

export interface FieldScanner {
  /**
   * Feed a new chunk from the streaming response. Emits every field
   * that completed between the previous and current buffer position.
   */
  feed: (chunk: string) => ScannedField[];
}

/**
 * Factory: returns a scanner that carries its own state. One scanner
 * per streaming request.
 *
 * State machine:
 *   - SEEK_FIELDS_KEY  — scan for `"fields"`; skip anything else
 *   - SEEK_FIELDS_OPEN — scan for `{` that opens the fields block
 *   - IN_FIELDS        — scan for `"fieldName":` followed by `{`
 *   - IN_FIELD_VALUE   — count braces until the field's object closes;
 *                         emit the completed slice and return to IN_FIELDS
 */
export function createFieldScanner(): FieldScanner {
  type State =
    | 'SEEK_FIELDS_KEY'
    | 'SEEK_FIELDS_OPEN'
    | 'IN_FIELDS'
    | 'IN_FIELD_VALUE';

  let state: State = 'SEEK_FIELDS_KEY';
  let buffer = '';
  // Position within `buffer` — we only rescan from here to avoid
  // quadratic scans as the buffer grows.
  let cursor = 0;
  let currentField: string | null = null;
  let fieldValueStart = -1;
  let braceDepth = 0;
  let inString = false;
  let escapeNext = false;
  const emitted = new Set<string>();

  function skipWhitespace(): void {
    while (cursor < buffer.length && /\s/.test(buffer[cursor]!)) cursor += 1;
  }

  /**
   * Read a JSON string starting at cursor (expects buffer[cursor] ===
   * '"'). Returns the unescaped value plus advances cursor past the
   * closing quote, or null if the string isn't complete yet.
   */
  function readJsonString(): string | null {
    if (buffer[cursor] !== '"') return null;
    let i = cursor + 1;
    let out = '';
    while (i < buffer.length) {
      const ch = buffer[i]!;
      if (ch === '\\') {
        if (i + 1 >= buffer.length) return null;
        const esc = buffer[i + 1]!;
        if (esc === 'n') out += '\n';
        else if (esc === 't') out += '\t';
        else if (esc === 'r') out += '\r';
        else if (esc === '"') out += '"';
        else if (esc === '\\') out += '\\';
        else if (esc === '/') out += '/';
        else out += esc;
        i += 2;
        continue;
      }
      if (ch === '"') {
        cursor = i + 1;
        return out;
      }
      out += ch;
      i += 1;
    }
    return null;
  }

  function emitIfComplete(): ScannedField | null {
    if (state !== 'IN_FIELD_VALUE' || !currentField) return null;
    if (fieldValueStart === -1) return null;
    // Scan forward from cursor balancing braces, tracking strings so
    // '{' and '}' inside string values don't confuse depth.
    while (cursor < buffer.length) {
      const ch = buffer[cursor]!;
      if (escapeNext) {
        escapeNext = false;
        cursor += 1;
        continue;
      }
      if (ch === '\\' && inString) {
        escapeNext = true;
        cursor += 1;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        cursor += 1;
        continue;
      }
      if (!inString) {
        if (ch === '{') braceDepth += 1;
        else if (ch === '}') {
          braceDepth -= 1;
          if (braceDepth === 0) {
            const slice = buffer.slice(fieldValueStart, cursor + 1);
            cursor += 1;
            try {
              const parsed = JSON.parse(slice);
              const name = currentField;
              currentField = null;
              fieldValueStart = -1;
              state = 'IN_FIELDS';
              if (!emitted.has(name)) {
                emitted.add(name);
                return { name, value: parsed };
              }
              return null;
            } catch {
              // Malformed slice; drop this field and continue.
              currentField = null;
              fieldValueStart = -1;
              state = 'IN_FIELDS';
              return null;
            }
          }
        }
      }
      cursor += 1;
    }
    return null;
  }

  return {
    feed(chunk: string): ScannedField[] {
      buffer += chunk;
      const results: ScannedField[] = [];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (cursor >= buffer.length) break;

        if (state === 'SEEK_FIELDS_KEY') {
          // Look for the literal `"fields"` key — the first occurrence
          // at depth > 0 is the fields container per our schema.
          const idx = buffer.indexOf('"fields"', cursor);
          if (idx === -1) {
            // Keep a tail that could still contain a partial key.
            cursor = Math.max(cursor, buffer.length - 8);
            break;
          }
          cursor = idx + '"fields"'.length;
          skipWhitespace();
          if (cursor >= buffer.length) break;
          if (buffer[cursor] !== ':') {
            // Saw "fields" but not as a key; back to seeking.
            continue;
          }
          cursor += 1;
          state = 'SEEK_FIELDS_OPEN';
        }

        if (state === 'SEEK_FIELDS_OPEN') {
          skipWhitespace();
          if (cursor >= buffer.length) break;
          if (buffer[cursor] !== '{') {
            // Not the object we expected — abort scanner.
            state = 'SEEK_FIELDS_KEY';
            continue;
          }
          cursor += 1;
          state = 'IN_FIELDS';
          continue;
        }

        if (state === 'IN_FIELDS') {
          skipWhitespace();
          if (cursor >= buffer.length) break;
          const ch = buffer[cursor];
          if (ch === ',') {
            cursor += 1;
            continue;
          }
          if (ch === '}') {
            // End of fields block.
            cursor += 1;
            state = 'SEEK_FIELDS_KEY';
            break;
          }
          if (ch !== '"') break; // Wait for more.
          const key = readJsonString();
          if (key === null) break; // Incomplete key; wait for more.
          skipWhitespace();
          if (cursor >= buffer.length) break;
          if (buffer[cursor] !== ':') break;
          cursor += 1;
          skipWhitespace();
          if (cursor >= buffer.length) break;
          if (buffer[cursor] !== '{') {
            // Non-object value — could be null, a string, a number, an
            // array, or nested primitives. Skip to the next top-level
            // comma or the closing `}` of the fields block, tracking
            // string/bracket depth so commas inside don't fool us.
            let depth = 0;
            let skipInString = false;
            let skipEscape = false;
            while (cursor < buffer.length) {
              const c = buffer[cursor]!;
              if (skipEscape) { skipEscape = false; cursor += 1; continue; }
              if (c === '\\' && skipInString) { skipEscape = true; cursor += 1; continue; }
              if (c === '"') { skipInString = !skipInString; cursor += 1; continue; }
              if (!skipInString) {
                if (c === '{' || c === '[') depth += 1;
                else if (c === '}' || c === ']') {
                  if (depth === 0) break;
                  depth -= 1;
                } else if (c === ',' && depth === 0) break;
              }
              cursor += 1;
            }
            continue;
          }
          currentField = key;
          fieldValueStart = cursor;
          braceDepth = 0;
          inString = false;
          escapeNext = false;
          state = 'IN_FIELD_VALUE';
          continue;
        }

        if (state === 'IN_FIELD_VALUE') {
          const emitted = emitIfComplete();
          if (emitted) {
            results.push(emitted);
            continue;
          }
          // Didn't complete — need more chunk.
          break;
        }
      }

      return results;
    }
  };
}
