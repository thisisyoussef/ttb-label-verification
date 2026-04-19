import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

import {
  CANONICAL_GOVERNMENT_WARNING,
  type ReviewExtractionField
} from '../src/shared/contracts/review';
import { loadLocalEnv } from '../src/server/load-local-env';
import { extractFieldsFromOcrText } from '../src/server/ocr-field-extractor';
import { reconcileExtractionWithOcr } from '../src/server/extraction-ocr-reconciler';
import { mergeOcrAndVlm, applyRegionOverrides } from '../src/server/extraction-merge';
import {
  buildGovernmentWarningCheck,
  normalizeGovernmentWarningText
} from '../src/server/government-warning-validator';
import {
  computeWarningSimilarity,
  similarityToVote,
  type WarningSignalVote
} from '../src/server/government-warning-vote';
import { createConfiguredReviewExtractor } from '../src/server/review-extractor-factory';
import { createNormalizedReviewIntake } from '../src/server/review-intake';
import {
  runOcrPrepassOverLabels,
  runVlmRegionDetectionOverLabels,
  runWarningOcvOverLabels,
  runWarningOcrCrossCheckOverLabels
} from '../src/server/multi-label-stages';
import { isOcrPrepassEnabled } from '../src/server/ocr-prepass';
import { isRegionDetectionEnabled } from '../src/server/vlm-region-detector';

type GoldenManifest = {
  slices: Record<string, { caseIds: string[] }>;
  cases: GoldenCase[];
};

type GoldenCase = {
  id: string;
  slug: string;
  title: string;
  assetPath?: string;
  requiresLiveAsset?: boolean;
  expectedPrimaryResult?: string;
  focus?: string[];
};

type WarningStepSnapshot = {
  present: boolean;
  confidence: number | null;
  similarity: number | null;
  vote: WarningSignalVote;
  length: number;
  preview: string | null;
};

type CaseDiagnostic = {
  id: string;
  slug: string;
  title: string;
  expectedPrimaryResult: string | null;
  focus: string[];
  assetPath: string;
  error?: string;
  steps: {
    ocr: WarningStepSnapshot & {
      status: 'success' | 'failed' | 'skipped';
      headerFound: boolean;
    };
    vlm: WarningStepSnapshot;
    merged: WarningStepSnapshot;
    reconciled: WarningStepSnapshot;
    ocv: {
      status: string;
      confidence: number | null;
      similarity: number | null;
      vote: WarningSignalVote;
      preview: string | null;
    };
    ocrCrossCheck: Record<string, unknown>;
    visualSignals: {
      prefixAllCaps: { status: string; confidence: number };
      prefixBold: { status: string; confidence: number };
      continuousParagraph: { status: string; confidence: number };
      separateFromOtherContent: { status: string; confidence: number };
      imageQuality: { state: string; score: number };
    };
  };
  final: {
    status: string;
    severity: string;
    confidence: number;
    summary: string;
    subChecks: Array<{ id: string; status: string; reason: string }>;
  };
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args.set(key, 'true');
      continue;
    }
    args.set(key, value);
    i += 1;
  }
  return {
    slice: args.get('slice') ?? 'cola-cloud-real',
    mode: args.get('mode') ?? 'cloud',
    tag: args.get('tag')?.trim() ?? ''
  };
}

function mimeTypeFor(assetPath: string) {
  if (assetPath.endsWith('.png')) return 'image/png';
  if (assetPath.endsWith('.jpg') || assetPath.endsWith('.jpeg')) return 'image/jpeg';
  if (assetPath.endsWith('.webp')) return 'image/webp';
  if (assetPath.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function toUpload(assetPath: string, buffer: Buffer) {
  return {
    fieldname: 'label',
    originalname: path.basename(assetPath),
    encoding: '7bit',
    mimetype: mimeTypeFor(assetPath),
    size: buffer.length,
    stream: Readable.from(buffer),
    destination: '',
    filename: '',
    path: '',
    buffer
  };
}

function preview(text: string | undefined, max = 120) {
  if (!text) return null;
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}

function similarityFor(text: string | undefined) {
  if (!text) return null;
  return Number(
    computeWarningSimilarity(
      normalizeGovernmentWarningText(text),
      CANONICAL_GOVERNMENT_WARNING
    ).toFixed(3)
  );
}

function snapshot(field: ReviewExtractionField | undefined): WarningStepSnapshot {
  if (!field?.present || !field.value) {
    return {
      present: false,
      confidence: field?.confidence ?? null,
      similarity: null,
      vote: 'abstain',
      length: 0,
      preview: null
    };
  }

  const similarity = similarityFor(field.value);

  return {
    present: true,
    confidence: field.confidence,
    similarity,
    vote: similarity == null ? 'abstain' : similarityToVote(similarity),
    length: field.value.length,
    preview: preview(field.value)
  };
}

async function main() {
  const { slice, mode, tag } = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();

  process.env.NODE_ENV = 'test';
  process.env.OPENAI_STORE = 'false';
  loadLocalEnv(repoRoot);

  const manifestPath = path.join(repoRoot, 'evals/golden/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as GoldenManifest;
  const sliceEntry = manifest.slices[slice];
  if (!sliceEntry) {
    throw new Error(`Unknown golden slice: ${slice}`);
  }

  const cases = manifest.cases.filter(
    (goldenCase) =>
      sliceEntry.caseIds.includes(goldenCase.id) &&
      goldenCase.requiresLiveAsset &&
      goldenCase.assetPath
  );
  if (cases.length === 0) {
    throw new Error(`Slice ${slice} has no live-asset cases to diagnose.`);
  }

  const extractorResult = createConfiguredReviewExtractor({
    env: process.env,
    requestedMode: mode === 'local' ? 'local' : 'cloud',
    enableCrossModeFallback: true
  });
  if (!extractorResult.success) {
    throw new Error(
      `Could not configure review extractor: ${extractorResult.error.message}`
    );
  }

  const useSimplePipeline =
    process.env.EXTRACTION_PIPELINE?.trim().toLowerCase() === 'simple';
  const prepassEnabled = isOcrPrepassEnabled() && !useSimplePipeline;

  console.log(
    `Diagnosing warning field on ${cases.length} cases from ${slice} (${extractorResult.value.providers.join(
      ' -> '
    )})`
  );

  const diagnostics: CaseDiagnostic[] = [];

  for (const goldenCase of cases) {
    const absoluteAssetPath = path.resolve(path.dirname(manifestPath), goldenCase.assetPath!);
    const buffer = await readFile(absoluteAssetPath);
    const intake = createNormalizedReviewIntake({
      file: toUpload(absoluteAssetPath, buffer),
      fields: {
        hasApplicationData: false,
        fields: {
          beverageTypeHint: 'auto',
          origin: 'domestic',
          varietals: []
        }
      }
    });

    console.log(`- ${goldenCase.id} ${goldenCase.slug}`);
    try {
      const ocrStage = prepassEnabled
        ? await runOcrPrepassOverLabels(intake.labels)
        : null;
      const ocrText = ocrStage && ocrStage.status !== 'failed' ? ocrStage.text : undefined;
      const ocrParsed = ocrText ? extractFieldsFromOcrText(ocrText) : null;

      const ocv = prepassEnabled
        ? await runWarningOcvOverLabels({ labels: intake.labels })
        : null;

      const extraction = await extractorResult.value.extractor(intake, {
        surface: '/api/review',
        extractionMode: mode === 'local' ? 'local' : 'cloud'
      });

      const merged = ocrParsed ? mergeOcrAndVlm(ocrParsed, extraction) : extraction;
      const withRegions =
        isRegionDetectionEnabled()
          ? applyRegionOverrides(
              merged,
              (await runVlmRegionDetectionOverLabels(intake.labels)).regions
            )
          : merged;
      const { extraction: reconciled } = reconcileExtractionWithOcr(withRegions, ocrText);

      const vlmWarning = reconciled.fields.governmentWarning.value ?? '';
      const ocrCrossCheck =
        vlmWarning.length > 0
          ? await runWarningOcrCrossCheckOverLabels({
              labels: intake.labels,
              vlmWarningText: vlmWarning
            })
          : ({ status: 'abstain', reason: 'no-vlm-warning-text' } as const);

      const warningCheck = buildGovernmentWarningCheck(
        reconciled,
        ocrCrossCheck,
        ocv ?? undefined
      );

      diagnostics.push({
        id: goldenCase.id,
        slug: goldenCase.slug,
        title: goldenCase.title,
        expectedPrimaryResult: goldenCase.expectedPrimaryResult ?? null,
        focus: goldenCase.focus ?? [],
        assetPath: path.relative(repoRoot, absoluteAssetPath),
        steps: {
          ocr: {
            status: !prepassEnabled
              ? 'skipped'
              : ocrStage?.status === 'failed'
                ? 'failed'
                : 'success',
            headerFound: Boolean(ocrText && /GOVERNMENT\s*WARNING/i.test(ocrText)),
            ...snapshot(ocrParsed?.fields.governmentWarning)
          },
          vlm: snapshot(extraction.fields.governmentWarning),
          merged: snapshot(merged.fields.governmentWarning),
          reconciled: snapshot(reconciled.fields.governmentWarning),
          ocv: {
            status: ocv?.status ?? 'skipped',
            confidence:
              typeof ocv?.confidence === 'number' ? Number(ocv.confidence.toFixed(3)) : null,
            similarity:
              typeof ocv?.similarity === 'number' ? Number(ocv.similarity.toFixed(3)) : null,
            vote:
              typeof ocv?.similarity === 'number' ? similarityToVote(ocv.similarity) : 'abstain',
            preview: preview(ocv?.extractedText)
          },
          ocrCrossCheck,
          visualSignals: {
            prefixAllCaps: {
              status: reconciled.warningSignals.prefixAllCaps.status,
              confidence: reconciled.warningSignals.prefixAllCaps.confidence
            },
            prefixBold: {
              status: reconciled.warningSignals.prefixBold.status,
              confidence: reconciled.warningSignals.prefixBold.confidence
            },
            continuousParagraph: {
              status: reconciled.warningSignals.continuousParagraph.status,
              confidence: reconciled.warningSignals.continuousParagraph.confidence
            },
            separateFromOtherContent: {
              status: reconciled.warningSignals.separateFromOtherContent.status,
              confidence: reconciled.warningSignals.separateFromOtherContent.confidence
            },
            imageQuality: {
              state: reconciled.imageQuality.state,
              score: reconciled.imageQuality.score
            }
          }
        },
        final: {
          status: warningCheck.status,
          severity: warningCheck.severity,
          confidence: warningCheck.confidence,
          summary: warningCheck.summary,
          subChecks:
            warningCheck.warning?.subChecks.map((subCheck) => ({
              id: subCheck.id,
              status: subCheck.status,
              reason: subCheck.reason
            })) ?? []
        }
      });
    } catch (error) {
      diagnostics.push({
        id: goldenCase.id,
        slug: goldenCase.slug,
        title: goldenCase.title,
        expectedPrimaryResult: goldenCase.expectedPrimaryResult ?? null,
        focus: goldenCase.focus ?? [],
        assetPath: path.relative(repoRoot, absoluteAssetPath),
        error: error instanceof Error ? error.message : String(error),
        steps: {
          ocr: {
            status: 'skipped',
            headerFound: false,
            present: false,
            confidence: null,
            similarity: null,
            vote: 'abstain',
            length: 0,
            preview: null
          },
          vlm: {
            present: false,
            confidence: null,
            similarity: null,
            vote: 'abstain',
            length: 0,
            preview: null
          },
          merged: {
            present: false,
            confidence: null,
            similarity: null,
            vote: 'abstain',
            length: 0,
            preview: null
          },
          reconciled: {
            present: false,
            confidence: null,
            similarity: null,
            vote: 'abstain',
            length: 0,
            preview: null
          },
          ocv: {
            status: 'skipped',
            confidence: null,
            similarity: null,
            vote: 'abstain',
            preview: null
          },
          ocrCrossCheck: { status: 'abstain', reason: 'case-error' },
          visualSignals: {
            prefixAllCaps: { status: 'uncertain', confidence: 0 },
            prefixBold: { status: 'uncertain', confidence: 0 },
            continuousParagraph: { status: 'uncertain', confidence: 0 },
            separateFromOtherContent: { status: 'uncertain', confidence: 0 },
            imageQuality: { state: 'low-confidence', score: 0 }
          }
        },
        final: {
          status: 'error',
          severity: 'major',
          confidence: 0,
          summary: 'Case diagnostics failed before warning validation completed.',
          subChecks: []
        }
      });
      console.error(`  error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const totals = diagnostics.reduce(
    (acc, diagnostic) => {
      acc.final[diagnostic.final.status] = (acc.final[diagnostic.final.status] ?? 0) + 1;
      if (diagnostic.steps.ocr.vote !== 'abstain') {
        acc.ocr[diagnostic.steps.ocr.vote] = (acc.ocr[diagnostic.steps.ocr.vote] ?? 0) + 1;
      }
      if (diagnostic.steps.vlm.vote !== 'abstain') {
        acc.vlm[diagnostic.steps.vlm.vote] = (acc.vlm[diagnostic.steps.vlm.vote] ?? 0) + 1;
      }
      if (diagnostic.steps.reconciled.vote !== 'abstain') {
        acc.reconciled[diagnostic.steps.reconciled.vote] =
          (acc.reconciled[diagnostic.steps.reconciled.vote] ?? 0) + 1;
      }
      if (diagnostic.steps.ocv.vote !== 'abstain') {
        acc.ocv[diagnostic.steps.ocv.vote] = (acc.ocv[diagnostic.steps.ocv.vote] ?? 0) + 1;
      }
      for (const subCheck of diagnostic.final.subChecks) {
        const bucket = (acc.subChecks[subCheck.id] ??= {});
        bucket[subCheck.status] = (bucket[subCheck.status] ?? 0) + 1;
      }
      return acc;
    },
    {
      final: {} as Record<string, number>,
      ocr: {} as Record<string, number>,
      vlm: {} as Record<string, number>,
      reconciled: {} as Record<string, number>,
      ocv: {} as Record<string, number>,
      subChecks: {} as Record<string, Record<string, number>>
    }
  );

  const output = {
    date: new Date().toISOString(),
    slice,
    mode,
    providers: extractorResult.value.providers,
    prepassEnabled,
    useSimplePipeline,
    totals,
    diagnostics
  };

  const outDir = path.join(repoRoot, 'evals/results');
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `${new Date().toISOString().slice(0, 10)}-warning-diagnostics-${slice}${tag ? `-${tag}` : ''}.json`
  );
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`\nFinal warning statuses: ${JSON.stringify(totals.final)}`);
  console.log(`OCR warning votes: ${JSON.stringify(totals.ocr)}`);
  console.log(`VLM warning votes: ${JSON.stringify(totals.vlm)}`);
  console.log(`Reconciled warning votes: ${JSON.stringify(totals.reconciled)}`);
  console.log(`OCV warning votes: ${JSON.stringify(totals.ocv)}`);
  console.log(`Exact-text subchecks: ${JSON.stringify(totals.subChecks['exact-text'] ?? {})}`);
  console.log(
    `Heading subchecks: ${JSON.stringify(totals.subChecks['uppercase-bold-heading'] ?? {})}`
  );
  console.log(`Wrote ${path.relative(repoRoot, outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
