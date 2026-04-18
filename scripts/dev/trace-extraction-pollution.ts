/**
 * Trace OCR→VLM pipeline to detect whether the LLM is polluting
 * the OCR text by substituting its own pixel-level reading.
 *
 * For each label: runs OCR pre-pass, captures the raw text,
 * runs the VLM, then compares OCR text vs VLM output per field.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.OPENAI_STORE = 'false';

async function main() {
  const repoRoot = process.cwd();
  const { loadLocalEnv } = await import('../../src/server/load-local-env');
  loadLocalEnv(repoRoot);

  const { runOcrPrepass } = await import('../../src/server/ocr-prepass');
  const { runWarningOcv } = await import('../../src/server/warning/warning-region-ocv');
  const { createApp } = await import('../../src/server/index');

  const labels = [
    { id: 'lake-placid', path: 'evals/labels/assets/cola-cloud/lake-placid-shredder-malt-beverage.webp', appAbv: '4% Alc./Vol.' },
    { id: 'harpoon', path: 'evals/labels/assets/cola-cloud/harpoon-ale-malt-beverage.webp', appAbv: '5% Alc./Vol.' },
    { id: 'persian-empire', path: 'evals/labels/assets/cola-cloud/persian-empire-black-widow-distilled-spirits.webp', appAbv: '40% Alc./Vol.' },
    { id: 'simply-elegant', path: 'evals/labels/assets/cola-cloud/simply-elegant-simply-elegant-spirits-distilled-spirits.webp', appAbv: '67% Alc./Vol.' },
  ];

  console.log('=== OCR → VLM POLLUTION TRACE ===\n');

  for (const label of labels) {
    const imgPath = path.join(repoRoot, label.path);
    const buffer = readFileSync(imgPath);
    const ext = path.extname(label.path).slice(1);
    const mime = ext === 'webp' ? 'image/webp' : 'image/png';

    const normalizedLabel = {
      originalName: path.basename(label.path),
      mimeType: mime,
      bytes: buffer.length,
      buffer
    };

    console.log(`── ${label.id} ──────────────────────────────────`);

    // Stage 1: OCR pre-pass
    const ocr = await runOcrPrepass(normalizedLabel);
    console.log(`OCR status: ${ocr.status}, duration: ${ocr.durationMs}ms`);
    if (ocr.status !== 'failed') {
      const ocrText = ocr.text;
      console.log(`OCR text (${ocrText.length} chars):`);
      console.log(ocrText.slice(0, 500));
      if (ocrText.length > 500) console.log('  ... [truncated]');

      // Check if OCR found key fields
      const abvMatch = ocrText.match(/(\d+(?:\.\d+)?)\s*%/);
      const warningMatch = ocrText.match(/GOVERNMENT\s*WARNING/i);
      console.log(`\nOCR field signals:`);
      console.log(`  ABV in OCR text: ${abvMatch ? abvMatch[0] : 'NOT FOUND'}`);
      console.log(`  Warning header in OCR: ${warningMatch ? 'FOUND' : 'NOT FOUND'}`);
      console.log(`  Expected ABV: ${label.appAbv}`);
    }

    // Stage 2: Warning OCV
    const ocv = await runWarningOcv({
      label: normalizedLabel,
      prepassOcrText: ocr.status !== 'failed' ? ocr.text : undefined
    });
    console.log(`\nOCV status: ${ocv.status}, similarity: ${ocv.similarity.toFixed(3)}, confidence: ${ocv.confidence}`);
    if (ocv.extractedText) {
      console.log(`OCV warning text: ${ocv.extractedText.slice(0, 200)}`);
    }

    // Stage 3: VLM extraction (via the API)
    const app = createApp();
    const server = await new Promise<import('node:http').Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const addr = server.address()!;
    if (typeof addr === 'string') { server.close(); continue; }
    const url = `http://127.0.0.1:${addr.port}`;

    const form = new FormData();
    form.append('label', new Blob([buffer], { type: mime }), path.basename(label.path));
    form.append('fields', JSON.stringify({
      beverageType: 'auto', brandName: '', fancifulName: '', classType: '',
      alcoholContent: label.appAbv, netContents: '', applicantAddress: '',
      origin: 'domestic', country: '', formulaId: '', appellation: '', vintage: '', varietals: []
    }));

    try {
      const res = await fetch(`${url}/api/review/extraction`, { method: 'POST', body: form });
      if (res.ok) {
        const data = await res.json() as any;
        console.log(`\nVLM extraction output:`);
        const fields = data.fields || {};
        for (const [key, val] of Object.entries(fields)) {
          if (key === 'varietals') continue;
          const f = val as any;
          if (f?.present) {
            console.log(`  ${key}: "${f.value}" (conf=${f.confidence?.toFixed(2)})`);
          }
        }
        // Compare ABV specifically
        const vlmAbv = fields.alcoholContent?.value;
        const ocrAbvMatch = ocr.status !== 'failed' ? ocr.text.match(/(\d+(?:\.\d+)?)\s*%/) : null;
        console.log(`\n  POLLUTION CHECK — ABV:`);
        console.log(`    OCR found: ${ocrAbvMatch ? ocrAbvMatch[0] : 'nothing'}`);
        console.log(`    VLM returned: ${vlmAbv ?? 'nothing'}`);
        console.log(`    App expected: ${label.appAbv}`);
        if (ocrAbvMatch && vlmAbv) {
          const ocrNum = parseFloat(ocrAbvMatch[1]);
          const vlmNum = parseFloat(vlmAbv);
          if (Math.abs(ocrNum - vlmNum) > 0.5) {
            console.log(`    ⚠️  VLM DIVERGED FROM OCR: OCR=${ocrNum}% VLM=${vlmNum}%`);
          } else {
            console.log(`    ✓ VLM matches OCR`);
          }
        }

        // Check warning
        const vlmWarning = fields.governmentWarning?.value;
        console.log(`\n  POLLUTION CHECK — Warning:`);
        console.log(`    OCR found warning: ${ocr.status !== 'failed' && /GOVERNMENT\s*WARNING/i.test(ocr.text) ? 'YES' : 'NO'}`);
        console.log(`    VLM warning present: ${fields.governmentWarning?.present ? 'YES' : 'NO'}`);
        if (vlmWarning) console.log(`    VLM warning text: ${vlmWarning.slice(0, 150)}...`);
      } else {
        console.log(`\nVLM extraction failed: HTTP ${res.status}`);
      }
    } catch (e) {
      console.log(`\nVLM extraction error: ${e}`);
    }

    server.close();
    console.log('\n');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
