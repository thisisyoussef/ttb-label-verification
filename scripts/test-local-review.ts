/**
 * Direct diagnostic — hits /api/review once with the local extractor.
 * Used to confirm the ollama-vlm path is actually reached.
 */
import { readFile } from 'node:fs/promises';

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.OPENAI_STORE = 'false';

  const { loadLocalEnv } = await import('../src/server/load-local-env');
  loadLocalEnv(process.cwd());

  console.log('env AI_PROVIDER=', process.env.AI_PROVIDER);
  console.log('env OLLAMA_VLM_ENABLED=', process.env.OLLAMA_VLM_ENABLED);
  console.log('env AI_EXTRACTION_MODE_DEFAULT=', process.env.AI_EXTRACTION_MODE_DEFAULT);
  console.log('env AI_EXTRACTION_MODE_ALLOW_LOCAL=', process.env.AI_EXTRACTION_MODE_ALLOW_LOCAL);

  const { createApp } = await import('../src/server/index');
  const app = createApp();

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const addr = server.address() as import('node:net').AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const form = new FormData();
  const buffer = await readFile(
    'evals/labels/assets/cola-cloud/1840-original-lager-1840-original-lager-malt-beverage.webp'
  );
  form.append(
    'label',
    new File([new Uint8Array(buffer)], 'test.webp', { type: 'image/webp' })
  );
  form.append(
    'fields',
    JSON.stringify({
      brandName: '1840 Original',
      classType: 'lager',
      alcoholContent: '4.9% Alc./Vol.',
      netContents: '12 fl oz'
    })
  );

  console.log('POST /api/review...');
  const t0 = performance.now();
  const resp = await fetch(`${baseUrl}/api/review`, {
    method: 'POST',
    body: form
  });
  const ms = Math.round(performance.now() - t0);
  console.log(`status=${resp.status}, took=${ms}ms`);
  const text = await resp.text();
  console.log('body prefix:', text.slice(0, 500));
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
