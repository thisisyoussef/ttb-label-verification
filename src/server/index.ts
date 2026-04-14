import { loadLocalEnv } from './load-local-env';

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import multer from 'multer';

import {
  BATCH_LABEL_CAP,
  MAX_LABEL_UPLOAD_BYTES,
  batchStartRequestSchema,
  checkReviewSchema,
  reviewExtractionSchema,
  type ReviewError,
  SUPPORTED_LABEL_MIME_TYPES,
  getSeedVerificationReport,
  healthResponseSchema,
  reviewErrorSchema
} from '../shared/contracts/review';
import { BatchSessionStore } from './batch-session';
import { buildGovernmentWarningCheck } from './government-warning-validator';
import {
  createOpenAIReviewExtractor,
  readReviewExtractionConfig
} from './openai-review-extractor';
import { buildVerificationReport } from './review-report';
import {
  isReviewExtractionFailure,
  type ReviewExtractor
} from './review-extraction';
import {
  createNormalizedReviewIntake,
  parseOptionalReviewFields,
  type NormalizedReviewIntake
} from './review-intake';

if (process.env.NODE_ENV !== 'test') {
  loadLocalEnv();
}

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const defaultClientDistDir = path.resolve(serverDir, '../../dist');

const reviewUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_LABEL_UPLOAD_BYTES,
    files: 1,
    fields: 4,
    parts: 6,
    fieldSize: 256 * 1024
  },
  fileFilter: (_request, file, callback) => {
    if (
      SUPPORTED_LABEL_MIME_TYPES.includes(
        file.mimetype as (typeof SUPPORTED_LABEL_MIME_TYPES)[number]
      )
    ) {
      callback(null, true);
      return;
    }

    const error = new Error('UNSUPPORTED_FILE_TYPE') as Error & { code: string };
    error.code = 'UNSUPPORTED_FILE_TYPE';
    callback(error);
  }
});
const uploadReviewLabel = reviewUpload.single('label');
const batchUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: BATCH_LABEL_CAP + 25,
    fields: 2,
    parts: BATCH_LABEL_CAP + 30,
    fieldSize: 512 * 1024
  }
});
const uploadBatchAssets = batchUpload.fields([
  { name: 'labels', maxCount: BATCH_LABEL_CAP + 25 },
  { name: 'labels[]', maxCount: BATCH_LABEL_CAP + 25 },
  { name: 'csv', maxCount: 1 }
]);

type CreateAppOptions = {
  clientDistDir?: string;
  extractor?: ReviewExtractor;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const clientDistDir = options.clientDistDir ?? defaultClientDistDir;
  const clientIndexPath = path.join(clientDistDir, 'index.html');
  const hasBuiltClient = existsSync(clientIndexPath);
  const extractorResolution = resolveExtractor(options);
  const batchSessions = new BatchSessionStore(
    extractorResolution.extractor ??
      (async () => {
        throw new Error('Extractor unavailable.');
      })
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json(
      healthResponseSchema.parse({
        status: 'ok',
        service: 'ttb-label-verification',
        mode: 'scaffold',
        responsesApi: true,
        store: false,
        timestamp: new Date().toISOString()
      })
    );
  });

  app.get('/api/review/seed', (_request, response) => {
    response.json(getSeedVerificationReport());
  });

  app.post('/api/review', (request, response) => {
    handleReviewUpload(request, response, async (intake) => {
      if (!extractorResolution.extractor) {
        sendReviewError(
          response,
          extractorResolution.status,
          extractorResolution.error
        );
        return;
      }

      const extraction = await extractorResolution.extractor(intake);
      const warningCheck = buildGovernmentWarningCheck(extraction);

      response.json(
        buildVerificationReport({
          intake,
          extraction,
          warningCheck
        })
      );
    });
  });

  app.post('/api/review/extraction', (request, response) => {
    handleReviewUpload(request, response, async (intake) => {
      if (!extractorResolution.extractor) {
        sendReviewError(
          response,
          extractorResolution.status,
          extractorResolution.error
        );
        return;
      }

      const extraction = await extractorResolution.extractor(intake);
      response.json(reviewExtractionSchema.parse(extraction));
    });
  });

  app.post('/api/review/warning', (request, response) => {
    handleReviewUpload(request, response, async (intake) => {
      if (!extractorResolution.extractor) {
        sendReviewError(
          response,
          extractorResolution.status,
          extractorResolution.error
        );
        return;
      }

      const extraction = await extractorResolution.extractor(intake);
      response.json(checkReviewSchema.parse(buildGovernmentWarningCheck(extraction)));
    });
  });

  app.post('/api/batch/preflight', (request, response) => {
    handleBatchUpload(request, response, async ({ manifest, imageFiles, csvFile }) => {
      const preflight = batchSessions.createPreflight({
        manifest,
        imageFiles,
        csvFile
      });

      response.json(preflight);
    });
  });

  app.post('/api/batch/run', async (request, response) => {
    if (!extractorResolution.extractor) {
      sendReviewError(response, extractorResolution.status, extractorResolution.error);
      return;
    }

    const payload = batchStartRequestSchema.safeParse(request.body);
    if (!payload.success) {
      sendReviewError(response, 400, {
        kind: 'validation',
        message: 'We could not read this batch request.',
        retryable: false
      });
      return;
    }

    response.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('cache-control', 'no-store');

    try {
      await batchSessions.run(payload.data, async (frame) => {
        response.write(`${JSON.stringify(frame)}\n`);
      });
      response.end();
    } catch (error) {
      if (response.headersSent) {
        response.end();
        return;
      }

      sendBatchError(response, error);
    }
  });

  app.post('/api/batch/:batchSessionId/cancel', (request, response) => {
    try {
      batchSessions.cancel(request.params.batchSessionId);
      response.status(202).json({ status: 'cancelling' });
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  app.get('/api/batch/:batchSessionId/summary', (request, response) => {
    try {
      response.json(batchSessions.getSummary(request.params.batchSessionId));
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  app.get('/api/batch/:batchSessionId/report/:reportId', (request, response) => {
    try {
      response.json(
        batchSessions.getReport(
          request.params.batchSessionId,
          request.params.reportId
        )
      );
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  app.get('/api/batch/:batchSessionId/export', (request, response) => {
    try {
      response.setHeader(
        'content-disposition',
        `attachment; filename="ttb-batch-${request.params.batchSessionId}.json"`
      );
      response.json(batchSessions.getExport(request.params.batchSessionId));
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  app.post('/api/batch/:batchSessionId/retry/:imageId', async (request, response) => {
    if (!extractorResolution.extractor) {
      sendReviewError(response, extractorResolution.status, extractorResolution.error);
      return;
    }

    try {
      response.json(
        await batchSessions.retry(
          request.params.batchSessionId,
          request.params.imageId
        )
      );
    } catch (error) {
      sendBatchError(response, error);
    }
  });

  if (hasBuiltClient) {
    app.use(
      express.static(clientDistDir, {
        index: false
      })
    );

    app.get('*', (request, response, next) => {
      if (request.path.startsWith('/api/')) {
        next();
        return;
      }

      response.sendFile(clientIndexPath);
    });
  }

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  const port = Number(process.env.PORT ?? 8787);

  app.listen(port, () => {
    console.log(`TTB label verification API listening on http://localhost:${port}`);
  });
}

function respondToReviewUploadError(error: unknown, response: express.Response) {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        sendReviewError(response, 413, {
          kind: 'validation',
          message: 'That file is too large. The limit is 10 MB.',
          retryable: false
        });
        return;
      case 'LIMIT_FILE_COUNT':
      case 'LIMIT_UNEXPECTED_FILE':
        sendReviewError(response, 400, {
          kind: 'validation',
          message: 'Upload one label image at a time.',
          retryable: false
        });
        return;
      case 'LIMIT_FIELD_COUNT':
      case 'LIMIT_PART_COUNT':
        sendReviewError(response, 400, {
          kind: 'validation',
          message: 'We could not read this review request.',
          retryable: false
        });
        return;
      default:
        break;
    }
  }

  if (
    error instanceof Error &&
    'code' in error &&
    (error as Error & { code?: string }).code === 'UNSUPPORTED_FILE_TYPE'
  ) {
    sendReviewError(response, 415, {
      kind: 'validation',
      message: 'We could not use that file. Please upload a JPEG, PNG, WEBP, or PDF.',
      retryable: false
    });
    return;
  }

  sendReviewError(response, 500, {
    kind: 'unknown',
    message: 'We could not start this review right now.',
    retryable: true
  });
}

function handleReviewUpload(
  request: express.Request,
  response: express.Response,
  onReady: (intake: NormalizedReviewIntake) => Promise<void>
) {
  uploadReviewLabel(request, response, (error) => {
    if (error) {
      respondToReviewUploadError(error, response);
      return;
    }

    if (!request.file) {
      sendReviewError(response, 400, {
        kind: 'validation',
        message: 'Add one label image before starting the review.',
        retryable: false
      });
      return;
    }

    const parsedFields = parseOptionalReviewFields(request.body.fields);
    if (!parsedFields.success) {
      sendReviewError(response, parsedFields.status, parsedFields.error);
      return;
    }

    void onReady(
      createNormalizedReviewIntake({
        file: request.file,
        fields: parsedFields.value
      })
    ).catch((handlerError) => {
      respondToReviewExecutionError(handlerError, response);
    });
  });
}

function handleBatchUpload(
  request: express.Request,
  response: express.Response,
  onReady: (input: {
    manifest: unknown;
    imageFiles: Express.Multer.File[];
    csvFile: Express.Multer.File;
  }) => Promise<void> | void
) {
  uploadBatchAssets(request, response, (error) => {
    if (error) {
      respondToReviewUploadError(error, response);
      return;
    }

    const files = request.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const imageFiles = [
      ...(files?.labels ?? []),
      ...(files?.['labels[]'] ?? [])
    ];
    const csvFile = files?.csv?.[0];
    if (!csvFile) {
      sendReviewError(response, 400, {
        kind: 'validation',
        message: 'Add one application CSV before starting the batch.',
        retryable: false
      });
      return;
    }

    const manifest = parseBatchManifest(request.body.manifest);
    if (!manifest.success) {
      sendReviewError(response, manifest.status, manifest.error);
      return;
    }

    Promise.resolve(
      onReady({
        manifest: manifest.value,
        imageFiles,
        csvFile
      })
    ).catch((caughtError) => {
      sendBatchError(response, caughtError);
    });
  });
}

function parseBatchManifest(rawManifest: unknown):
  | { success: true; value: unknown }
  | { success: false; status: number; error: ReviewError } {
  if (typeof rawManifest !== 'string' || rawManifest.trim().length === 0) {
    return {
      success: false,
      status: 400,
      error: {
        kind: 'validation',
        message: 'We could not read this batch request.',
        retryable: false
      }
    };
  }

  try {
    return {
      success: true,
      value: JSON.parse(rawManifest)
    };
  } catch {
    return {
      success: false,
      status: 400,
      error: {
        kind: 'validation',
        message: 'We could not read this batch request.',
        retryable: false
      }
    };
  }
}

function sendBatchError(response: express.Response, error: unknown) {
  if (isReviewExtractionFailure(error)) {
    sendReviewError(response, error.status, error.error);
    return;
  }

  sendReviewError(response, 500, {
    kind: 'unknown',
    message: 'We could not finish this batch right now.',
    retryable: true
  });
}

function resolveExtractor(options: CreateAppOptions):
  | {
      extractor: ReviewExtractor;
    }
  | {
      extractor?: undefined;
      status: number;
      error: ReviewError;
    } {
  if (options.extractor) {
    return {
      extractor: options.extractor
    };
  }

  const configResult = readReviewExtractionConfig(process.env);
  if (!configResult.success) {
    return configResult;
  }

  return {
    extractor: createOpenAIReviewExtractor({
      config: configResult.value
    })
  };
}

function respondToReviewExecutionError(
  error: unknown,
  response: express.Response
) {
  if (isReviewExtractionFailure(error)) {
    sendReviewError(response, error.status, error.error);
    return;
  }

  if (isReviewExtractionFailureLike(error)) {
    sendReviewError(response, error.status, error.error);
    return;
  }

  sendReviewError(response, 500, {
    kind: 'unknown',
    message: 'We could not finish this review right now.',
    retryable: true
  });
}

function sendReviewError(
  response: express.Response,
  status: number,
  payload: ReviewError
) {
  response.status(status).json(reviewErrorSchema.parse(payload));
}

function isReviewExtractionFailureLike(
  error: unknown
): error is { status: number; error: ReviewError } {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (
    'status' in error &&
    typeof error.status === 'number' &&
    'error' in error &&
    reviewErrorSchema.safeParse(error.error).success
  );
}
