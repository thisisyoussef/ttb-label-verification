import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDotEnvFile } from '../src/server/load-local-env';

const DEFAULT_ENV_VALUES = {
  OPENAI_MODEL: 'gpt-5.4-mini',
  OPENAI_VISION_MODEL: 'gpt-5.4-mini',
  OPENAI_VISION_DETAIL: 'auto',
  OPENAI_SERVICE_TIER: '',
  OPENAI_STORE: 'false',
  GEMINI_API_KEY: '',
  GEMINI_VISION_MODEL: 'gemini-2.5-flash-lite',
  GEMINI_TIMEOUT_MS: '5000',
  GEMINI_MEDIA_RESOLUTION: '',
  GEMINI_SERVICE_TIER: '',
  GEMINI_THINKING_BUDGET: '',
  GEMINI_TEXT_MODEL: '',
  GEMINI_EMBEDDING_MODEL: '',
  AI_CAPABILITY_DEFAULT_ORDER: 'openai,gemini',
  AI_CAPABILITY_LABEL_EXTRACTION_ORDER: 'gemini,openai',
  AI_EXTRACTION_MODE_DEFAULT: 'cloud',
  AI_EXTRACTION_MODE_ALLOW_LOCAL: 'false',
  OLLAMA_HOST: 'http://localhost:11434',
  OLLAMA_LABEL_EXTRACTION_MODEL: '',
  TRANSFORMERS_LOCAL_MODEL: 'HuggingFaceTB/SmolVLM-500M-Instruct',
  TRANSFORMERS_DTYPE: 'q4',
  TRANSFORMERS_TIMEOUT_MS: '15000',
  TRANSFORMERS_CACHE_DIR: '.cache/transformers',
  PORT: '8787',
  STITCH_FLOW_MODE: 'claude-direct',
  STITCH_API_KEY: '',
  STITCH_PROJECT_ID: '3197911668966401642',
  STITCH_PROJECT_TITLE: 'TTB Label Verification System',
  STITCH_MODEL_ID: 'GEMINI_3_1_PRO',
  STITCH_DEVICE_TYPE: 'DESKTOP',
  STITCH_AUTOMATION_REVIEW_REQUIRED: 'true',
  STITCH_GENERATION_TIMEOUT_MS: '180000',
  STITCH_DOWNLOAD_TIMEOUT_MS: '60000'
} as const;

const OPENAI_ENV_KEY = 'OPENAI_API_KEY';
const GEMINI_ENV_KEY = 'GEMINI_API_KEY';
const orderedKeys = [
  OPENAI_ENV_KEY,
  GEMINI_ENV_KEY,
  'OLLAMA_HOST',
  ...Object.keys(DEFAULT_ENV_VALUES)
] as const;
const ignoredDirectoryNames = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage'
]);

type KeySource = {
  sourceKey: string;
  sourcePath: string;
  sourceType: 'existing' | 'inventory';
  value: string;
};

function findCandidateEnvFiles(rootDir: string, currentRepoDir: string) {
  const matches: string[] = [];

  function walk(currentDir: string) {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (ignoredDirectoryNames.has(entry.name)) {
          continue;
        }

        walk(path.join(currentDir, entry.name));
        continue;
      }

      if (entry.name !== '.env' && entry.name !== '.env.local') {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);
      if (fullPath.startsWith(currentRepoDir)) {
        continue;
      }

      matches.push(fullPath);
    }
  }

  walk(rootDir);
  return matches.sort((left, right) => left.localeCompare(right));
}

function getKeySource(input: {
  existingEnv: Record<string, string>;
  fallbackSourceKeys?: string[];
  repoDir: string;
  targetKey: string;
}) {
  const sourceKeys = [input.targetKey, ...(input.fallbackSourceKeys ?? [])];

  for (const sourceKey of sourceKeys) {
    const existingValue = input.existingEnv[sourceKey]?.trim();
    if (!existingValue) {
      continue;
    }

    return {
      sourceKey,
      sourcePath: path.join(input.repoDir, '.env'),
      sourceType: 'existing',
      value: existingValue
    } satisfies KeySource;
  }

  const gauntletRoot = path.resolve(input.repoDir, '..');
  for (const candidatePath of findCandidateEnvFiles(gauntletRoot, input.repoDir)) {
    const candidateEnv = parseDotEnvFile(candidatePath);

    for (const sourceKey of sourceKeys) {
      const candidateValue = candidateEnv[sourceKey]?.trim();
      if (!candidateValue) {
        continue;
      }

      return {
        sourceKey,
        sourcePath: candidatePath,
        sourceType: 'inventory',
        value: candidateValue
      } satisfies KeySource;
    }
  }

  return null;
}

function describeKeySource(targetKey: string, source: KeySource) {
  const sourceLabel =
    source.sourceKey === targetKey
      ? targetKey
      : `${source.sourceKey} -> ${targetKey}`;

  return `${sourceLabel} redacted from ${source.sourcePath}`;
}

export function renderEnvFile(values: Record<string, string>) {
  const orderedEntries: Array<[string, string]> = [];
  const seenKeys = new Set<string>();

  for (const key of orderedKeys) {
    if (seenKeys.has(key)) {
      continue;
    }

    const value = values[key];
    if (value === undefined) {
      continue;
    }

    orderedEntries.push([key, value]);
    seenKeys.add(key);
  }

  for (const key of Object.keys(values).sort((left, right) =>
    left.localeCompare(right)
  )) {
    if (seenKeys.has(key)) {
      continue;
    }

    orderedEntries.push([key, values[key]]);
  }

  return (
    orderedEntries.map(([key, value]) => `${key}=${value}`).join('\n') + '\n'
  );
}

export function bootstrapLocalEnv(repoDir = process.cwd()) {
  const envPath = path.join(repoDir, '.env');
  const existingEnv = parseDotEnvFile(envPath);
  const openAiSource = getKeySource({
    existingEnv,
    repoDir,
    targetKey: OPENAI_ENV_KEY
  });
  const geminiSource = getKeySource({
    existingEnv,
    repoDir,
    targetKey: GEMINI_ENV_KEY
  });

  if (!openAiSource) {
    throw new Error(
      'env:bootstrap could not find OPENAI_API_KEY in this repo or the local gauntlet env inventory.'
    );
  }

  const mergedEnv: Record<string, string> = {
    ...DEFAULT_ENV_VALUES,
    ...existingEnv,
    [OPENAI_ENV_KEY]: openAiSource.value
  };
  if (geminiSource) {
    mergedEnv[GEMINI_ENV_KEY] = geminiSource.value;
  }

  writeFileSync(envPath, renderEnvFile(mergedEnv), 'utf8');

  const sources = [openAiSource, geminiSource].filter(
    (source): source is KeySource => source !== null
  );
  const sourceTypes = sources.map((source) => source.sourceType);
  const actionLabel = sourceTypes.every((sourceType) => sourceType === 'existing')
    ? 'validated'
    : 'created';
  const sourceDescriptions = sources.map((source) =>
    describeKeySource(
      source.sourceKey === GEMINI_ENV_KEY ? GEMINI_ENV_KEY : OPENAI_ENV_KEY,
      source
    )
  );

  console.log(`${actionLabel} ${envPath}`);
  for (const sourceDescription of sourceDescriptions) {
    console.log(`- ${sourceDescription}`);
  }

  return {
    actionLabel,
    envPath,
    sourceDescriptions
  };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    bootstrapLocalEnv();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'env:bootstrap failed unexpectedly.'
    );
    process.exitCode = 1;
  }
}
