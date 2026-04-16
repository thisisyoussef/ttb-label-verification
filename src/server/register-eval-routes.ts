import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import express from 'express';

const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..'
);
const LABELS_ROOT = path.join(REPO_ROOT, 'evals/labels/assets');
const BATCH_MANIFEST_PATH = path.join(
  REPO_ROOT,
  'evals/batch/cola-cloud/manifest.json'
);
const BATCH_DIR = path.join(REPO_ROOT, 'evals/batch/cola-cloud');

type ManifestSet = {
  id: string;
  title: string;
  description: string;
  csvFile: string;
  imageCases: Array<{
    id: string;
    assetPath: string;
    beverageType: string;
    expectedRecommendation?: string;
    source: string;
  }>;
};

type Manifest = {
  sets: ManifestSet[];
};

function readManifest(): Manifest | null {
  if (!existsSync(BATCH_MANIFEST_PATH)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(BATCH_MANIFEST_PATH, 'utf8')) as Manifest;
  } catch {
    return null;
  }
}

function mimeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

export function registerEvalRoutes(app: express.Express) {
  app.get('/api/eval/packs', (_request, response) => {
    const manifest = readManifest();
    if (!manifest) {
      response
        .status(404)
        .json({ kind: 'validation', message: 'Eval manifest unavailable.' });
      return;
    }

    const packs = manifest.sets.map((set) => ({
      id: set.id,
      title: set.title,
      description: set.description,
      csvFile: set.csvFile,
      imageCount: set.imageCases.length,
      images: set.imageCases.map((entry) => ({
        id: entry.id,
        source: entry.source,
        assetPath: entry.assetPath,
        filename: path.basename(entry.assetPath),
        beverageType: entry.beverageType,
        expectedRecommendation: entry.expectedRecommendation
      }))
    }));

    response.setHeader('cache-control', 'no-store');
    response.json({ packs });
  });

  app.get('/api/eval/pack/:packId/csv', (request, response) => {
    const manifest = readManifest();
    if (!manifest) {
      response
        .status(404)
        .json({ kind: 'validation', message: 'Eval manifest unavailable.' });
      return;
    }

    const set = manifest.sets.find((entry) => entry.id === request.params.packId);
    if (!set) {
      response
        .status(404)
        .json({ kind: 'validation', message: 'Unknown eval pack.' });
      return;
    }

    const csvPath = path.join(BATCH_DIR, set.csvFile);
    if (!existsSync(csvPath)) {
      response
        .status(404)
        .json({ kind: 'validation', message: 'CSV fixture missing on disk.' });
      return;
    }

    response.setHeader('content-type', 'text/csv; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.setHeader(
      'content-disposition',
      `attachment; filename="${set.csvFile}"`
    );
    response.send(readFileSync(csvPath));
  });

  // Serves an image from the evals/labels/assets subtree.
  // `source` is a subdirectory like "cola-cloud" or "supplemental-generated".
  // `filename` is the base image filename. Path traversal is blocked.
  app.get('/api/eval/label-image/:source/:filename', (request, response) => {
    const { source, filename } = request.params;
    if (!source || !filename) {
      response.status(400).end();
      return;
    }

    if (
      source.includes('..') ||
      source.includes('/') ||
      source.includes('\\') ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      response.status(400).end();
      return;
    }

    const resolved = path.join(LABELS_ROOT, source, filename);
    if (!resolved.startsWith(LABELS_ROOT)) {
      response.status(400).end();
      return;
    }

    if (!existsSync(resolved)) {
      response.status(404).end();
      return;
    }

    const stats = statSync(resolved);
    if (!stats.isFile()) {
      response.status(404).end();
      return;
    }

    response.setHeader('content-type', mimeForFilename(filename));
    response.setHeader('cache-control', 'public, max-age=3600');
    response.setHeader('content-length', String(stats.size));
    createReadStream(resolved).pipe(response);
  });
}
