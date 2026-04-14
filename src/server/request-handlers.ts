import express from 'express';
import multer from 'multer';

import {
  BATCH_LABEL_CAP,
  MAX_LABEL_UPLOAD_BYTES,
  SUPPORTED_LABEL_MIME_TYPES,
  reviewErrorSchema,
  type ReviewError
} from '../shared/contracts/review';
import {
  isReviewExtractionFailure
} from './review-extraction';
import {
  createNormalizedReviewIntake,
  parseOptionalReviewFields,
  type NormalizedReviewIntake
} from './review-intake';

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

export type PreparedReviewUpload = {
  success: true;
  intake: NormalizedReviewIntake;
  parse: {
    outcome: 'success';
    durationMs: number;
  };
  normalization: {
    outcome: 'success';
    durationMs: number;
  };
} | {
  success: false;
  parse: {
    outcome: 'success' | 'fast-fail';
    durationMs: number;
  };
  normalization: {
    outcome: 'success' | 'fast-fail' | 'skipped';
    durationMs: number;
  };
};

export async function prepareReviewUpload(
  request: express.Request,
  response: express.Response
): Promise<PreparedReviewUpload> {
  const parseStartedAt = performance.now();

  try {
    await runReviewUpload(request, response);
  } catch (error) {
    respondToReviewUploadError(error, response);
    return {
      success: false,
      parse: {
        outcome: 'fast-fail',
        durationMs: performance.now() - parseStartedAt
      },
      normalization: {
        outcome: 'skipped',
        durationMs: 0
      }
    };
  }

  const parseDurationMs = performance.now() - parseStartedAt;
  if (!request.file) {
    sendReviewError(response, 400, {
      kind: 'validation',
      message: 'Add one label image before starting the review.',
      retryable: false
    });
    return {
      success: false,
      parse: {
        outcome: 'success',
        durationMs: parseDurationMs
      },
      normalization: {
        outcome: 'skipped',
        durationMs: 0
      }
    };
  }

  const normalizationStartedAt = performance.now();
  const parsedFields = parseOptionalReviewFields(request.body.fields);
  if (!parsedFields.success) {
    sendReviewError(response, parsedFields.status, parsedFields.error);
    return {
      success: false,
      parse: {
        outcome: 'success',
        durationMs: parseDurationMs
      },
      normalization: {
        outcome: 'fast-fail',
        durationMs: performance.now() - normalizationStartedAt
      }
    };
  }

  return {
    success: true,
    intake: createNormalizedReviewIntake({
      file: request.file,
      fields: parsedFields.value
    }),
    parse: {
      outcome: 'success',
      durationMs: parseDurationMs
    },
    normalization: {
      outcome: 'success',
      durationMs: performance.now() - normalizationStartedAt
    }
  };
}

export function handleReviewUpload(
  request: express.Request,
  response: express.Response,
  onReady: (intake: NormalizedReviewIntake) => Promise<void>
) {
  void prepareReviewUpload(request, response)
    .then((prepared) => {
      if (!prepared.success) {
        return;
      }

      return onReady(prepared.intake);
    })
    .catch((handlerError) => {
      respondToReviewExecutionError(handlerError, response);
    });
}

export function handleBatchUpload(
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

    const files = request.files as Record<string, Express.Multer.File[]> | undefined;
    const imageFiles = [...(files?.labels ?? []), ...(files?.['labels[]'] ?? [])];
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

export function sendBatchError(response: express.Response, error: unknown) {
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

export function sendReviewError(
  response: express.Response,
  status: number,
  payload: ReviewError
) {
  response.status(status).json(reviewErrorSchema.parse(payload));
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

export function respondToReviewExecutionError(
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

function runReviewUpload(
  request: express.Request,
  response: express.Response
) {
  return new Promise<void>((resolve, reject) => {
    uploadReviewLabel(request, response, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
