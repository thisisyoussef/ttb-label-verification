import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { GoogleGenAI, JobState, type InlinedResponse } from '@google/genai';

import {
  INLINE_BATCH_MAX_BYTES,
  buildGeminiBatchInlineRequests,
  parseGeminiBatchExtractionResponses,
  summarizeGeminiBatchExtractionResults
} from './gemini-batch-extraction';
import {
  GEMINI_BATCH_BENCHMARK_STORY_ID,
  loadGeminiBatchBenchmarkCorpus,
  parseGeminiBatchBenchmarkArgs,
  resolveGeminiBatchBenchmarkOutputPath,
  sanitizeTimestampForFilename,
  summarizeGeminiBatchBenchmarkSources,
  type GeminiBatchBenchmarkOptions,
  writeGeminiBatchBenchmarkArtifact
} from './gemini-batch-benchmark-helpers';
import { loadLocalEnv } from '../../src/server/load-local-env';
import { readGeminiReviewExtractionConfig } from '../../src/server/gemini-review-extractor';

async function main() {
  const repoRoot = process.cwd();
  const options = parseGeminiBatchBenchmarkArgs(process.argv.slice(2));

  process.env.NODE_ENV = 'test';
  process.env.OPENAI_STORE = 'false';
  loadLocalEnv(repoRoot);

  const config = readBenchmarkConfig(options);
  const corpus = await loadGeminiBatchBenchmarkCorpus(repoRoot);
  const { requests, estimatedBytes } = buildGeminiBatchInlineRequests({
    cases: corpus,
    config
  });

  const generatedAt = new Date().toISOString();
  const outputPath = resolveGeminiBatchBenchmarkOutputPath({
    repoRoot,
    generatedAt,
    outputPath: options.outputPath
  });
  const sourceCounts = summarizeGeminiBatchBenchmarkSources(corpus);

  if (options.dryRun) {
    const dryRunArtifact = {
      storyId: GEMINI_BATCH_BENCHMARK_STORY_ID,
      mode: 'dry-run',
      generatedAt,
      model: config.visionModel,
      cases: corpus.length,
      sources: sourceCounts,
      estimatedInlineBytes: estimatedBytes,
      inlineByteLimit: INLINE_BATCH_MAX_BYTES,
      outputPath: path.relative(repoRoot, outputPath)
    };

    await writeGeminiBatchBenchmarkArtifact(outputPath, dryRunArtifact);
    printDryRunSummary(dryRunArtifact);
    return;
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('GEMINI_API_KEY is required for live Gemini Batch benchmark runs.');
  }

  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const displayName = `${GEMINI_BATCH_BENCHMARK_STORY_ID.toLowerCase()}-${sanitizeTimestampForFilename(generatedAt)}`;

  const createdJob = await ai.batches.create({
    model: config.visionModel,
    src: requests,
    config: {
      displayName
    }
  });

  const createdJobName = createdJob.name;
  if (!createdJobName) {
    throw new Error('Gemini Batch create call did not return a job name.');
  }

  console.log(
    `[gemini-batch] submitted ${createdJobName} with ${corpus.length} cases (${estimatedBytes} bytes estimated inline payload)`
  );

  const completedJob = await waitForCompletedBatchJob(ai, createdJobName, options);
  const state = completedJob.state ?? JobState.JOB_STATE_UNSPECIFIED;

  if (
    state !== JobState.JOB_STATE_SUCCEEDED &&
    state !== JobState.JOB_STATE_PARTIALLY_SUCCEEDED
  ) {
    throw new Error(
      `Gemini Batch finished in ${state}: ${completedJob.error?.message ?? 'no error message returned'}`
    );
  }

  const rawResponses = completedJob.dest?.inlinedResponses ?? [];
  if (rawResponses.length === 0) {
    throw new Error('Gemini Batch finished without any inlined responses.');
  }

  const parsedResults = parseGeminiBatchExtractionResponses({
    cases: corpus,
    responses: rawResponses.map(mapInlinedResponse)
  });
  const summary = summarizeGeminiBatchExtractionResults(parsedResults);

  const completedJobName = completedJob.name ?? createdJobName;
  const cleanup = await maybeDeleteBatchJob(ai, completedJobName, options.keepJob);

  const liveArtifact = {
    storyId: GEMINI_BATCH_BENCHMARK_STORY_ID,
    mode: 'live',
    generatedAt,
    model: config.visionModel,
    cases: corpus.length,
    sources: sourceCounts,
    estimatedInlineBytes: estimatedBytes,
    inlineByteLimit: INLINE_BATCH_MAX_BYTES,
    batchJob: {
      name: completedJobName,
      displayName: completedJob.displayName ?? displayName,
      state,
      createTime: completedJob.createTime ?? null,
      updateTime: completedJob.updateTime ?? null,
      error: completedJob.error ?? null
    },
    cleanup,
    summary,
    results: parsedResults
  };

  await writeGeminiBatchBenchmarkArtifact(outputPath, liveArtifact);
  printLiveSummary({
    repoRoot,
    outputPath,
    cases: corpus.length,
    state,
    summary
  });
}

function readBenchmarkConfig(options: Pick<GeminiBatchBenchmarkOptions, 'dryRun'>) {
  const configEnv = {
    ...process.env
  } as Record<string, string | undefined>;

  if (options.dryRun && !configEnv.GEMINI_API_KEY?.trim()) {
    configEnv.GEMINI_API_KEY = 'dry-run';
  }

  const configResult = readGeminiReviewExtractionConfig(configEnv);
  if (!configResult.success) {
    throw new Error(configResult.error.message);
  }

  return configResult.value;
}

async function waitForCompletedBatchJob(
  ai: GoogleGenAI,
  jobName: string,
  options: Pick<GeminiBatchBenchmarkOptions, 'pollMs' | 'timeoutMs'>
) {
  const start = Date.now();

  while (true) {
    const job = await ai.batches.get({ name: jobName });
    const state = job.state ?? JobState.JOB_STATE_UNSPECIFIED;

    if (isTerminalBatchState(state)) {
      return job;
    }

    if (Date.now() - start > options.timeoutMs) {
      throw new Error(
        `Timed out waiting for Gemini Batch job ${jobName} after ${options.timeoutMs}ms. Last state: ${state}.`
      );
    }

    console.log(`[gemini-batch] ${jobName} -> ${state}`);
    await sleep(options.pollMs);
  }
}

async function maybeDeleteBatchJob(
  ai: GoogleGenAI,
  jobName: string,
  keepJob: boolean
) {
  if (keepJob) {
    return {
      attempted: false,
      deleted: false,
      error: null
    };
  }

  try {
    await ai.batches.delete({ name: jobName });
    return {
      attempted: true,
      deleted: true,
      error: null
    };
  } catch (error) {
    return {
      attempted: true,
      deleted: false,
      error:
        error instanceof Error ? error.message : 'Unknown Gemini Batch delete failure.'
    };
  }
}

function isTerminalBatchState(state: JobState) {
  return (
    state === JobState.JOB_STATE_SUCCEEDED ||
    state === JobState.JOB_STATE_PARTIALLY_SUCCEEDED ||
    state === JobState.JOB_STATE_FAILED ||
    state === JobState.JOB_STATE_CANCELLED ||
    state === JobState.JOB_STATE_EXPIRED
  );
}

function mapInlinedResponse(response: InlinedResponse) {
  return {
    metadata: response.metadata,
    response: {
      text: response.response?.text
    },
    error: response.error
  };
}

function printDryRunSummary(input: {
  storyId: string;
  mode: string;
  model: string;
  cases: number;
  sources: Record<string, number>;
  estimatedInlineBytes: number;
  inlineByteLimit: number;
  outputPath: string;
}) {
  console.log(`[gemini-batch] ${input.storyId} ${input.mode}`);
  console.log(`[gemini-batch] model=${input.model}`);
  console.log(
    `[gemini-batch] cases=${input.cases} sources=${JSON.stringify(input.sources)}`
  );
  console.log(
    `[gemini-batch] estimated-inline-bytes=${input.estimatedInlineBytes}/${input.inlineByteLimit}`
  );
  console.log(`[gemini-batch] wrote ${input.outputPath}`);
}

function printLiveSummary(input: {
  repoRoot: string;
  outputPath: string;
  cases: number;
  state: JobState;
  summary: ReturnType<typeof summarizeGeminiBatchExtractionResults>;
}) {
  console.log(`[gemini-batch] finished in ${input.state} for ${input.cases} cases`);
  console.log(
    `[gemini-batch] success=${input.summary.successCount} requestErrors=${input.summary.requestErrorCount} parseErrors=${input.summary.parseErrorCount} schemaErrors=${input.summary.schemaErrorCount}`
  );
  console.log(
    `[gemini-batch] wrote ${path.relative(input.repoRoot, input.outputPath)}`
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
