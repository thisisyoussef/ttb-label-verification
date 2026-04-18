import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  loadGeminiBatchBenchmarkCorpus,
  parseGeminiBatchBenchmarkArgs,
  resolveGeminiBatchBenchmarkOutputPath
} from './gemini-batch-benchmark-helpers';

describe('run-gemini-batch-extraction-benchmark', () => {
  it('parses dry-run, keep-job, and output overrides', () => {
    const options = parseGeminiBatchBenchmarkArgs([
      '--dry-run',
      '--keep-job',
      '--output',
      'evals/results/custom-run.json'
    ]);

    expect(options).toMatchObject({
      dryRun: true,
      keepJob: true,
      outputPath: 'evals/results/custom-run.json'
    });
  });

  it('builds the approved live corpus with cola cloud and supplemental cases', async () => {
    const repoRoot = process.cwd();
    const corpus = await loadGeminiBatchBenchmarkCorpus(repoRoot);

    expect(corpus.length).toBeGreaterThan(10);

    const colaCloudCase = corpus.find(
      (caseItem) => caseItem.id === 'persian-empire-black-widow-distilled-spirits'
    );
    expect(colaCloudCase).toMatchObject({
      source: 'cola-cloud',
      fields: {
        origin: 'imported',
        country: 'canada',
        formulaId: '26100001000115'
      },
      expectedFields: {
        brandName: 'Persian Empire',
        classType: 'other specialties & proprietaries',
        alcoholContent: '40% Alc./Vol.'
      }
    });

    const supplementalCase = corpus.find(
      (caseItem) => caseItem.id === 'lake-placid-shredder-abv-negative'
    );
    expect(supplementalCase).toMatchObject({
      source: 'supplemental-generated',
      fields: {
        origin: 'domestic',
        brandName: 'Lake Placid',
        country: undefined,
        formulaId: undefined
      },
      expectedFields: {
        alcoholContent: '5% Alc./Vol.',
        netContents: '12 FL OZ'
      }
    });
  });

  it('defaults the output path into evals/results with a json artifact name', () => {
    const repoRoot = '/tmp/ttb-label-verification';
    const outputPath = resolveGeminiBatchBenchmarkOutputPath({
      repoRoot,
      generatedAt: '2026-04-18T15:04:05.678Z'
    });

    expect(outputPath).toBe(
      path.join(
        repoRoot,
        'evals/results/2026-04-18T15-04-05-678Z-TTB-EVAL-002-gemini-batch-extraction.json'
      )
    );
  });
});
