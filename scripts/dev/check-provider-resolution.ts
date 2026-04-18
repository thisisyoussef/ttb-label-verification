process.env.NODE_ENV = 'test';
import { createConfiguredReviewExtractor } from '../../src/server/review-extractor-factory';
import { readExtractionRoutingPolicy } from '../../src/server/ai-provider-policy';
import { loadLocalEnv } from '../../src/server/load-local-env';

loadLocalEnv(process.cwd());

console.log('AI_PROVIDER=', process.env.AI_PROVIDER);
console.log('AI_EXTRACTION_MODE_DEFAULT=', process.env.AI_EXTRACTION_MODE_DEFAULT);
console.log('AI_EXTRACTION_MODE_ALLOW_LOCAL=', process.env.AI_EXTRACTION_MODE_ALLOW_LOCAL);

const policy = readExtractionRoutingPolicy(process.env);
console.log('policy:', JSON.stringify(policy, null, 2));

const r = createConfiguredReviewExtractor({ env: process.env });
if (r.success) {
  console.log('providers:', r.value.providers);
  console.log('mode:', r.value.extractionMode);
} else {
  console.log('FAIL', r.error, 'status:', r.status);
}
