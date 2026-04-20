import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { reviewExtractionSchema } from '../../src/shared/contracts/review';

type ColaCloudCase = {
  id: string;
  title: string;
  beverageType: string;
  expectedRecommendation: string;
  assetPath: string;
  colaCloudMeta: {
    brandName: string;
    productName: string | null;
    className: string;
    abv: number | null;
    wineAppellation: string | null;
    wineVintageYear: number | null;
  };
};

type ColaCloudManifest = {
  sliceId: string;
  cases: ColaCloudCase[];
};

type SupplementalNegativeCase = {
  id: string;
  title: string;
  beverageType: string;
  expectedRecommendation: string;
  assetPath: string;
  mutation: {
    kind: string;
    note: string;
  };
  batchCsv: {
    brandName: string;
    fancifulName: string;
    classType: string;
    alcoholContent: string;
    netContents: string;
    appellation: string;
    vintage: string;
  };
};

type SupplementalNegativeManifest = {
  sliceId: string;
  cases: SupplementalNegativeCase[];
};

type CorpusCase = {
  id: string;
  title: string;
  sliceId: string;
  source: 'cola-cloud' | 'supplemental-generated';
  beverageType: string;
  expectedRecommendation: string;
  assetPath: string;
  expectedFields: {
    brandName: string;
    fancifulName: string;
    classType: string;
    alcoholContent: string;
    netContents: string;
    appellation: string;
    vintage: string;
  };
};

type FieldScore = {
  expected: string;
  present: boolean;
  extracted: string | null;
  comparison: 'exact' | 'cosmetic' | 'mismatch' | 'missing' | 'not-applicable';
  confidence: number;
  note: string | null;
};

type AggregateMetric = {
  total: number;
  present: number;
  exact: number;
  cosmetic: number;
  mismatch: number;
  missing: number;
};

function normalizeExact(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeCosmetic(value: string) {
  return normalizeExact(value)
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compareExpectedToExtracted(
  expected: string,
  extracted: string | undefined
): FieldScore['comparison'] {
  if (expected.trim().length === 0) {
    return extracted && extracted.trim().length > 0 ? 'mismatch' : 'not-applicable';
  }

  if (!extracted || extracted.trim().length === 0) {
    return 'missing';
  }

  const normalizedExpected = normalizeExact(expected);
  const normalizedExtracted = normalizeExact(extracted);
  if (normalizedExpected === normalizedExtracted) {
    return 'exact';
  }
  if (
    normalizedExpected.toLowerCase() === normalizedExtracted.toLowerCase() ||
    normalizeCosmetic(expected) === normalizeCosmetic(extracted)
  ) {
    return 'cosmetic';
  }

  return 'mismatch';
}

function formatAlcoholContent(abv: number | null) {
  if (abv === null) {
    return '';
  }

  return `${Number.isInteger(abv) ? String(abv) : String(abv)}% Alc./Vol.`;
}

function defaultNetContents(beverageType: string) {
  return beverageType === 'malt-beverage' ? '12 FL OZ' : '750 mL';
}

function makeFile(buffer: Buffer, filename: string, type: string) {
  return new File([new Uint8Array(buffer)], filename, { type });
}

function mimeTypeFor(filePath: string) {
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function emptyMetric(): AggregateMetric {
  return { total: 0, present: 0, exact: 0, cosmetic: 0, mismatch: 0, missing: 0 };
}

function applyFieldScore(metric: AggregateMetric, score: FieldScore) {
  if (score.comparison === 'not-applicable') {
    return;
  }
  metric.total += 1;
  if (score.present) metric.present += 1;
  if (score.comparison === 'exact') metric.exact += 1;
  if (score.comparison === 'cosmetic') metric.cosmetic += 1;
  if (score.comparison === 'mismatch') metric.mismatch += 1;
  if (score.comparison === 'missing') metric.missing += 1;
}

async function main() {
  const repoRoot = process.cwd();
  process.env.NODE_ENV = 'test';
  process.env.OPENAI_STORE = 'false';

  const { loadLocalEnv } = await import('../../src/server/load-local-env');
  loadLocalEnv(repoRoot);
  const { createApp } = await import('../../src/server/index');

  const colaManifest = JSON.parse(
    await readFile(path.join(repoRoot, 'evals/labels/cola-cloud.manifest.json'), 'utf8')
  ) as ColaCloudManifest;
  const supplementalManifest = JSON.parse(
    await readFile(
      path.join(repoRoot, 'evals/labels/supplemental-negative.manifest.json'),
      'utf8'
    )
  ) as SupplementalNegativeManifest;

  const corpus: CorpusCase[] = [
    ...colaManifest.cases.map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      sliceId: colaManifest.sliceId,
      source: 'cola-cloud' as const,
      beverageType: testCase.beverageType,
      expectedRecommendation: testCase.expectedRecommendation,
      assetPath: path.join(repoRoot, 'evals/labels', testCase.assetPath),
      expectedFields: {
        brandName: testCase.colaCloudMeta.brandName,
        fancifulName: testCase.colaCloudMeta.productName ?? '',
        classType: testCase.colaCloudMeta.className,
        alcoholContent: formatAlcoholContent(testCase.colaCloudMeta.abv),
        netContents: defaultNetContents(testCase.beverageType),
        appellation: testCase.colaCloudMeta.wineAppellation ?? '',
        vintage:
          testCase.colaCloudMeta.wineVintageYear === null
            ? ''
            : String(testCase.colaCloudMeta.wineVintageYear)
      }
    })),
    ...supplementalManifest.cases.map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      sliceId: supplementalManifest.sliceId,
      source: 'supplemental-generated' as const,
      beverageType: testCase.beverageType,
      expectedRecommendation: testCase.expectedRecommendation,
      assetPath: path.join(repoRoot, 'evals/labels', testCase.assetPath),
      expectedFields: {
        brandName: testCase.batchCsv.brandName,
        fancifulName: testCase.batchCsv.fancifulName,
        classType: testCase.batchCsv.classType,
        alcoholContent: testCase.batchCsv.alcoholContent,
        netContents: testCase.batchCsv.netContents,
        appellation: testCase.batchCsv.appellation,
        vintage: testCase.batchCsv.vintage
      }
    }))
  ];

  const app = createApp();
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not determine extraction benchmark server address.');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const fieldMetrics = {
      beverageType: emptyMetric(),
      brandName: emptyMetric(),
      fancifulName: emptyMetric(),
      classType: emptyMetric(),
      alcoholContent: emptyMetric(),
      netContents: emptyMetric(),
      appellation: emptyMetric(),
      vintage: emptyMetric()
    };

    const rows = [];

    for (const testCase of corpus) {
      const buffer = await readFile(testCase.assetPath);
      const filename = path.basename(testCase.assetPath);
      const form = new FormData();
      form.append('label', makeFile(buffer, filename, mimeTypeFor(filename)));

      const response = await fetch(`${baseUrl}/api/review/extraction`, {
        method: 'POST',
        body: form
      });

      if (!response.ok) {
        rows.push({
          id: testCase.id,
          title: testCase.title,
          sliceId: testCase.sliceId,
          source: testCase.source,
          expectedRecommendation: testCase.expectedRecommendation,
          status: 'error',
          statusCode: response.status,
          errorBody: await response.text()
        });
        continue;
      }

      const extraction = reviewExtractionSchema.parse(await response.json());

      const beverageTypeScore: FieldScore = {
        expected: testCase.beverageType,
        present: true,
        extracted: extraction.beverageType,
        comparison:
          extraction.beverageType === testCase.beverageType
            ? 'exact'
            : extraction.beverageType.toLowerCase() === testCase.beverageType.toLowerCase()
              ? 'cosmetic'
              : 'mismatch',
        confidence: extraction.imageQuality.score,
        note: extraction.beverageTypeSource
      };

      const fieldScores = {
        brandName: {
          expected: testCase.expectedFields.brandName,
          present: extraction.fields.brandName.present,
          extracted: extraction.fields.brandName.value ?? null,
          comparison: compareExpectedToExtracted(
            testCase.expectedFields.brandName,
            extraction.fields.brandName.value
          ),
          confidence: extraction.fields.brandName.confidence,
          note: extraction.fields.brandName.note ?? null
        },
        fancifulName: {
          expected: testCase.expectedFields.fancifulName,
          present: extraction.fields.fancifulName.present,
          extracted: extraction.fields.fancifulName.value ?? null,
          comparison: compareExpectedToExtracted(
            testCase.expectedFields.fancifulName,
            extraction.fields.fancifulName.value
          ),
          confidence: extraction.fields.fancifulName.confidence,
          note: extraction.fields.fancifulName.note ?? null
        },
        classType: {
          expected: testCase.expectedFields.classType,
          present: extraction.fields.classType.present,
          extracted: extraction.fields.classType.value ?? null,
          comparison: compareExpectedToExtracted(
            testCase.expectedFields.classType,
            extraction.fields.classType.value
          ),
          confidence: extraction.fields.classType.confidence,
          note: extraction.fields.classType.note ?? null
        },
        alcoholContent: {
          expected: testCase.expectedFields.alcoholContent,
          present: extraction.fields.alcoholContent.present,
          extracted: extraction.fields.alcoholContent.value ?? null,
          comparison: compareExpectedToExtracted(
            testCase.expectedFields.alcoholContent,
            extraction.fields.alcoholContent.value
          ),
          confidence: extraction.fields.alcoholContent.confidence,
          note: extraction.fields.alcoholContent.note ?? null
        },
        netContents: {
          expected: testCase.expectedFields.netContents,
          present: extraction.fields.netContents.present,
          extracted: extraction.fields.netContents.value ?? null,
          comparison: compareExpectedToExtracted(
            testCase.expectedFields.netContents,
            extraction.fields.netContents.value
          ),
          confidence: extraction.fields.netContents.confidence,
          note: extraction.fields.netContents.note ?? null
        },
        appellation: {
          expected: testCase.expectedFields.appellation,
          present: extraction.fields.appellation.present,
          extracted: extraction.fields.appellation.value ?? null,
          comparison: compareExpectedToExtracted(
            testCase.expectedFields.appellation,
            extraction.fields.appellation.value
          ),
          confidence: extraction.fields.appellation.confidence,
          note: extraction.fields.appellation.note ?? null
        },
        vintage: {
          expected: testCase.expectedFields.vintage,
          present: extraction.fields.vintage.present,
          extracted: extraction.fields.vintage.value ?? null,
          comparison: compareExpectedToExtracted(
            testCase.expectedFields.vintage,
            extraction.fields.vintage.value
          ),
          confidence: extraction.fields.vintage.confidence,
          note: extraction.fields.vintage.note ?? null
        }
      };

      applyFieldScore(fieldMetrics.beverageType, beverageTypeScore);
      applyFieldScore(fieldMetrics.brandName, fieldScores.brandName);
      applyFieldScore(fieldMetrics.fancifulName, fieldScores.fancifulName);
      applyFieldScore(fieldMetrics.classType, fieldScores.classType);
      applyFieldScore(fieldMetrics.alcoholContent, fieldScores.alcoholContent);
      applyFieldScore(fieldMetrics.netContents, fieldScores.netContents);
      applyFieldScore(fieldMetrics.appellation, fieldScores.appellation);
      applyFieldScore(fieldMetrics.vintage, fieldScores.vintage);

      rows.push({
        id: testCase.id,
        title: testCase.title,
        sliceId: testCase.sliceId,
        source: testCase.source,
        expectedRecommendation: testCase.expectedRecommendation,
        model: extraction.model,
        extractionSummary: extraction.summary,
        imageQuality: extraction.imageQuality,
        beverageTypeSource: extraction.beverageTypeSource,
        warningSignals: extraction.warningSignals,
        beverageType: beverageTypeScore,
        fields: fieldScores
      });
    }

    const output = {
      generatedAt: new Date().toISOString(),
      totals: {
        rows: rows.length,
        errors: rows.filter((row) => row.status === 'error').length
      },
      fieldMetrics,
      rows
    };

    const jsonPath = path.join(
      repoRoot,
      'evals/results/2026-04-15-TTB-EVAL-001-extraction-real-corpus.json'
    );
    await writeFile(jsonPath, JSON.stringify(output, null, 2) + '\n');

    const mdLines = [
      '# TTB-EVAL-001 Extraction Real Corpus Run',
      '',
      'Date: 2026-04-15',
      'Runner: `npx tsx scripts/run-cola-cloud-extraction-benchmark.ts`',
      `Raw output: \`evals/results/${path.basename(jsonPath)}\``,
      '',
      '## Totals',
      '',
      `- rows: ${output.totals.rows}`,
      `- errors: ${output.totals.errors}`,
      '',
      '## Field Metrics',
      '',
      '| Field | Total | Present | Exact | Cosmetic | Mismatch | Missing |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'
    ];

    for (const [field, metric] of Object.entries(fieldMetrics)) {
      mdLines.push(
        `| \`${field}\` | ${metric.total} | ${metric.present} | ${metric.exact} | ${metric.cosmetic} | ${metric.mismatch} | ${metric.missing} |`
      );
    }

    await writeFile(
      path.join(repoRoot, 'evals/results/2026-04-15-TTB-EVAL-001-extraction-real-corpus.md'),
      `${mdLines.join('\n')}\n`
    );

    console.log(`[extraction-benchmark] wrote ${jsonPath}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
