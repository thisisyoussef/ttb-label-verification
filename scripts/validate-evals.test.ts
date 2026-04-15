import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validateEvalManifests } from './validate-evals';

describe('validate evals script', () => {
  it('accepts the checked-in live label subsets', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

    const report = validateEvalManifests({ repoRoot });

    expect(report.liveLabelManifests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'manifest.json',
          sliceId: 'core-six',
          caseCount: 6
        }),
        expect.objectContaining({
          fileName: 'latency-twenty.manifest.json',
          sliceId: 'latency-twenty',
          caseCount: 20
        })
      ])
    );
  });
});
