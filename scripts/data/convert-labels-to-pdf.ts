/**
 * Convert the COLA Cloud + supplemental-generated golden label image set into
 * single-page PDFs, preserving the original pixel data so the OCR/VLM pipeline
 * isn't disadvantaged by the container format change.
 *
 * Approach: we re-encode each source image as PNG with `sharp` (to strip
 * container-specific quirks like WebP variants that not every PDF library
 * renders consistently), then wrap it in a single-page PDF via ImageMagick
 * `convert -density 300`. ImageMagick embeds the raw PNG pixels at the exact
 * resolution we hand it; it does not resample. After rasterization by the
 * intake converter, we get back the same pixel content.
 *
 * Usage:
 *   npx tsx scripts/convert-labels-to-pdf.ts
 *
 * Outputs:
 *   evals/labels/assets/cola-cloud-pdf/<name>.pdf
 *   evals/labels/assets/supplemental-generated-pdf/<name>.pdf
 */
import { execFile } from 'node:child_process';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';

import sharp from 'sharp';

const execFileAsync = promisify(execFile);

const SOURCE_DIRS: Array<{
  src: string;
  dest: string;
}> = [
  {
    src: 'evals/labels/assets/cola-cloud',
    dest: 'evals/labels/assets/cola-cloud-pdf'
  },
  {
    src: 'evals/labels/assets/supplemental-generated',
    dest: 'evals/labels/assets/supplemental-generated-pdf'
  }
];

const SUPPORTED_EXTENSIONS = new Set(['.webp', '.png', '.jpg', '.jpeg']);

async function convertOne(sourcePath: string, destPath: string) {
  // Re-encode to PNG first. Some PDF rasterizers (pdfjs-dist) choke on WebP
  // variants, and the final intake rasterizer (`pdf-to-img`) is pdfjs-based.
  // Going PNG→PDF→PNG guarantees a clean round trip.
  const pngBuffer = await sharp(sourcePath).png({ compressionLevel: 6 }).toBuffer();
  const meta = await sharp(pngBuffer).metadata();

  const tmpPng = path.join(
    tmpdir(),
    `ttb-pdf-convert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  );
  await writeFile(tmpPng, pngBuffer);

  try {
    // -density 300 stores the page at 300 DPI; ImageMagick does NOT resample —
    // it embeds the PNG pixels directly. The density just controls the PDF
    // page dimensions, which in turn tells downstream rasterizers how big to
    // render the page. pdf-to-img uses scale=2 by default (= 144 DPI), so at
    // -density 300 the rasterized output ends up at ~2x pixel density, which
    // is fine for labels that are typically 400-1600px wide.
    await execFileAsync(
      'convert',
      [
        '-density',
        '300',
        '-units',
        'PixelsPerInch',
        tmpPng,
        '-compress',
        'lossless',
        destPath
      ],
      { timeout: 15000 }
    );
    return { width: meta.width, height: meta.height };
  } finally {
    try {
      await unlink(tmpPng);
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const repoRoot = process.cwd();
  let totalConverted = 0;

  for (const { src, dest } of SOURCE_DIRS) {
    const absSrc = path.join(repoRoot, src);
    const absDest = path.join(repoRoot, dest);
    await mkdir(absDest, { recursive: true });

    const entries = await readdir(absSrc);
    const imageFiles = entries
      .filter((name) => SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort();

    console.log(`\n[${src}] converting ${imageFiles.length} files -> ${dest}`);

    for (const name of imageFiles) {
      const srcPath = path.join(absSrc, name);
      const base = path.basename(name, path.extname(name));
      const destPath = path.join(absDest, `${base}.pdf`);
      try {
        const { width, height } = await convertOne(srcPath, destPath);
        console.log(`  ok  ${name.padEnd(70)} (${width}x${height})`);
        totalConverted++;
      } catch (error) {
        console.log(`  ERR ${name}: ${(error as Error).message}`);
      }
    }
  }

  console.log(`\nDone. Converted ${totalConverted} files to PDF.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
