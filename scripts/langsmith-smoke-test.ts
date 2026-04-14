import { spawnSync } from 'node:child_process';

import {
  buildLangSmithProcessEnv,
  readLangSmithConfig
} from '../src/server/langsmith-config';
import { loadLocalEnv } from '../src/server/load-local-env';

type LangSmithProjectRecord = {
  id?: string;
  name?: string;
};

loadLocalEnv();

const config = readLangSmithConfig(process.env);

if (!config.apiKey) {
  console.error(
    'Missing LangSmith auth. Run `npm run env:bootstrap` to populate LANGSMITH_API_KEY from the local gauntlet env inventory.'
  );
  process.exit(1);
}

const result = spawnSync(
  'langsmith',
  ['project', 'list', '--format', 'json', '--limit', '100'],
  {
    cwd: process.cwd(),
    env: buildLangSmithProcessEnv(process.env),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  }
);

if (result.error) {
  console.error(`Could not launch the LangSmith CLI: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  const errorOutput =
    result.stderr.trim() ||
    result.stdout.trim() ||
    `langsmith exited with code ${result.status}`;

  console.error(`LangSmith smoke test failed.\n${errorOutput}`);
  process.exit(result.status ?? 1);
}

let projects: LangSmithProjectRecord[];

try {
  projects = JSON.parse(result.stdout) as LangSmithProjectRecord[];
} catch {
  console.error('LangSmith smoke test returned invalid JSON output.');
  process.exit(1);
}

const targetProject = projects.find((project) => project.name === config.project);

console.log('LangSmith connected.');
console.log(`Projects visible: ${projects.length}`);
console.log(`Target project: ${config.project}`);
console.log(`Target project exists: ${targetProject ? 'yes' : 'no'}`);
console.log(`Tracing default: ${config.tracingEnabled ? 'enabled' : 'disabled'}`);
