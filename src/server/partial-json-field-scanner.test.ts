import { describe, expect, it } from 'vitest';

import { createFieldScanner } from './partial-json-field-scanner';

describe('partial-json-field-scanner', () => {
  it('emits each field value in order as chunks arrive', () => {
    const scanner = createFieldScanner();
    const out: string[] = [];

    const payload =
      '{"beverageTypeHint":"wine","fields":{' +
      '"brandName":{"present":true,"value":"Leitz","confidence":0.95},' +
      '"classType":{"present":true,"value":"Riesling","confidence":0.9}' +
      '}}';

    // Split the payload into random-ish small chunks
    for (let i = 0; i < payload.length; i += 11) {
      const emitted = scanner.feed(payload.slice(i, i + 11));
      for (const field of emitted) out.push(field.name);
    }

    expect(out).toEqual(['brandName', 'classType']);
  });

  it('parses the field value into a typed object', () => {
    const scanner = createFieldScanner();
    const emitted = scanner.feed(
      '{"fields":{"alcoholContent":{"present":true,"value":"13.5% Alc./Vol.","confidence":0.95}}}'
    );
    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.name).toBe('alcoholContent');
    expect(emitted[0]!.value).toEqual({
      present: true,
      value: '13.5% Alc./Vol.',
      confidence: 0.95
    });
  });

  it('does not re-emit a field that was already emitted', () => {
    const scanner = createFieldScanner();
    const chunk =
      '{"fields":{"brandName":{"present":true,"value":"Leitz","confidence":0.95}}}';
    const first = scanner.feed(chunk);
    const second = scanner.feed('');
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
  });

  it('tolerates braces inside string values', () => {
    const scanner = createFieldScanner();
    const emitted = scanner.feed(
      '{"fields":{"brandName":{"present":true,"value":"Brace { Inside }","confidence":0.9}}}'
    );
    expect(emitted).toHaveLength(1);
    expect((emitted[0]!.value as { value: string }).value).toBe('Brace { Inside }');
  });

  it('skips non-object values (null, arrays) without getting stuck', () => {
    const scanner = createFieldScanner();
    const payload =
      '{"fields":{"varietals":[{"name":"Riesling"}],"brandName":{"present":true,"value":"Leitz","confidence":0.95}}}';
    const emitted = scanner.feed(payload);
    // Our scanner only emits object-valued fields; varietals (array) is skipped.
    expect(emitted.map((f) => f.name)).toEqual(['brandName']);
  });
});
