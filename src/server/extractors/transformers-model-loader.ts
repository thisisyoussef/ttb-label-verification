import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type {
  TransformersInferenceFn,
  TransformersReviewExtractionConfig
} from './transformers-review-extractor';

type PendingRequest = {
  resolve: (value: { text: string }) => void;
  reject: (reason: Error) => void;
};

let worker: Worker | null = null;
const pendingRequests = new Map<string, PendingRequest>();

function getWorkerPath() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.join(path.dirname(currentFile), 'transformers-inference-worker.js');
}

function ensureWorker(): Worker {
  if (worker) return worker;

  const w = new Worker(getWorkerPath());

  w.on(
    'message',
    (response: {
      id: string;
      success: boolean;
      text?: string;
      error?: string;
    }) => {
      const pending = pendingRequests.get(response.id);
      if (!pending) return;

      pendingRequests.delete(response.id);

      if (response.success) {
        pending.resolve({ text: response.text ?? '' });
      } else {
        pending.reject(new Error(response.error ?? 'Inference failed'));
      }
    }
  );

  w.on('error', (error) => {
    for (const pending of pendingRequests.values()) {
      pending.reject(error);
    }
    pendingRequests.clear();
    worker = null;
  });

  w.on('exit', () => {
    for (const pending of pendingRequests.values()) {
      pending.reject(new Error('Worker exited unexpectedly'));
    }
    pendingRequests.clear();
    worker = null;
  });

  worker = w;
  return w;
}

export function createTransformersInferenceFn(
  config: TransformersReviewExtractionConfig
): TransformersInferenceFn {
  return async (input) => {
    const w = ensureWorker();
    const id = randomUUID();

    return new Promise<{ text: string }>((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });

      w.postMessage({
        id,
        prompt: input.prompt,
        imageBase64: input.imageBase64,
        imageMimeType: input.imageMimeType,
        model: config.model,
        dtype: config.dtype,
        cacheDir: config.cacheDir
      });
    });
  };
}

export function terminateTransformersWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    pendingRequests.clear();
  }
}
