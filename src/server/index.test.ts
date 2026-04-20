import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_LABEL_UPLOAD_BYTES,
  checkReviewSchema,
  reviewExtractionSchema,
  reviewErrorSchema,
  verificationReportSchema
} from '../shared/contracts/review';
import {
  buildExtractionPayload,
  buildLabelFile,
  cleanupTestResources,
  postReview,
  postReviewExtraction,
  postReviewWarning,
  presentField,
  registerServer,
  registerTempDir,
  serverUrl,
  startServer,
  validReviewFields
} from './index.test-helpers';

afterEach(cleanupTestResources);

describe('server deployment surfaces', () => {
  it('serves the health endpoint as a no-persistence contract', async () => {
    const server = await startServer();
    registerServer(server);

    const response = await fetch(serverUrl(server, '/api/health'));

    expect(response.status).toBe(200);

    const payload = (await response.json()) as { store: boolean; service: string };

    expect(payload.service).toBe('ttb-label-verification');
    expect(payload.store).toBe(false);
  });

  it('serves the built client when an index file exists', async () => {
    const clientDistDir = mkdtempSync(path.join(tmpdir(), 'ttb-client-dist-'));
    registerTempDir(clientDistDir);
    writeFileSync(
      path.join(clientDistDir, 'index.html'),
      '<!doctype html><html><body><div id="root">deployed-client</div></body></html>'
    );

    const server = await startServer({ clientDistDir });
    registerServer(server);

    const response = await fetch(serverUrl(server, '/'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('deployed-client');
  });

  it('does not turn unknown api routes into the client fallback', async () => {
    const clientDistDir = mkdtempSync(path.join(tmpdir(), 'ttb-client-dist-'));
    registerTempDir(clientDistDir);
    writeFileSync(
      path.join(clientDistDir, 'index.html'),
      '<!doctype html><html><body><div id="root">deployed-client</div></body></html>'
    );

    const server = await startServer({ clientDistDir });
    registerServer(server);

    const response = await fetch(serverUrl(server, '/api/missing'));
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).not.toContain('deployed-client');
  });

  it('accepts a multipart review request and returns the integrated report', async () => {
    const extractor = vi.fn().mockResolvedValue(buildExtractionPayload());
    const server = await startServer({ extractor });
    registerServer(server);

    const response = await postReview(server, {
      fields: JSON.stringify({
        ...validReviewFields(),
        brandName: "Stone's Throw",
        classType: 'Vodka',
        alcoholContent: '45% Alc./Vol.',
        netContents: '750 mL'
      })
    });

    expect(response.status).toBe(200);

    const payload = verificationReportSchema.parse(await response.json());

    expect(payload.noPersistence).toBe(true);
    expect(payload.mode).toBe('single-label');
    expect(payload.id).toBe('extract-demo-001');
    expect(payload.checks.some((check) => check.id === 'class-type')).toBe(true);
    expect(payload.checks.find((check) => check.id === 'government-warning')?.warning).toBeDefined();
    expect(extractor).toHaveBeenCalledTimes(1);
  }, 15000);

  it('accepts review requests when application fields are omitted', async () => {
    const extractor = vi.fn().mockResolvedValue(
      buildExtractionPayload({
        standalone: true,
        hasApplicationData: false,
        fields: {
          alcoholContent: presentField('45% Alc./Vol.', 0.93)
        }
      })
    );
    const server = await startServer({ extractor });
    registerServer(server);

    const response = await postReview(server, {
      fields: null
    });

    expect(response.status).toBe(200);

    const payload = verificationReportSchema.parse(await response.json());

    expect(payload.noPersistence).toBe(true);
    expect(payload.standalone).toBe(true);
    expect(payload.verdict).toBe('review');
    expect(payload.checks[0]?.comparison?.status).toBe('not-applicable');
  }, 15000);

  it('returns submitted application values in the integrated comparison rows', async () => {
    const extractor = vi.fn().mockResolvedValue(buildExtractionPayload());
    const server = await startServer({ extractor });
    registerServer(server);

    const response = await postReview(server, {
      fields: JSON.stringify({
        ...validReviewFields(),
        brandName: 'My Custom Brand',
        classType: 'Vodka',
        alcoholContent: '45% Alc./Vol.',
        netContents: '750 mL'
      })
    });

    expect(response.status).toBe(200);

    const payload = verificationReportSchema.parse(await response.json());
    const brand = payload.checks.find((check) => check.id === 'brand-name');

    expect(payload.standalone).toBe(false);
    expect(brand?.applicationValue).toBe('My Custom Brand');
    expect(brand?.comparison?.status).toBe('value-mismatch');
  }, 15000);

  it('maps missing extractor configuration to a structured review error on the review route', async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const server = await startServer();
      registerServer(server);

      const response = await postReview(server);

      expect(response.status).toBe(503);

      const payload = reviewErrorSchema.parse(await response.json());

      expect(payload.kind).toBe('adapter');
      expect(payload.retryable).toBe(false);
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
    }
  });

  it('returns the extraction contract from the extraction route', async () => {
    const extractor = vi.fn().mockResolvedValue({
      id: 'extract-demo-001',
      model: 'gpt-5.4',
      beverageType: 'unknown',
      beverageTypeSource: 'strict-fallback',
      modelBeverageTypeHint: 'unknown',
      standalone: true,
      hasApplicationData: false,
      noPersistence: true,
      imageQuality: {
        score: 0.34,
        state: 'low-confidence',
        issues: ['Bottle glare across small text']
      },
      warningSignals: {
        prefixAllCaps: {
          status: 'uncertain',
          confidence: 0.33
        },
        prefixBold: {
          status: 'uncertain',
          confidence: 0.25
        },
        continuousParagraph: {
          status: 'uncertain',
          confidence: 0.29
        },
        separateFromOtherContent: {
          status: 'uncertain',
          confidence: 0.31
        }
      },
      fields: {
        brandName: {
          present: true,
          value: 'North Ridge',
          confidence: 0.78
        },
        fancifulName: {
          present: false,
          confidence: 0.1
        },
        classType: {
          present: false,
          confidence: 0.24
        },
        alcoholContent: {
          present: false,
          confidence: 0.14
        },
        netContents: {
          present: false,
          confidence: 0.19
        },
        applicantAddress: {
          present: false,
          confidence: 0.08
        },
        countryOfOrigin: {
          present: false,
          confidence: 0.07
        },
        ageStatement: {
          present: false,
          confidence: 0.05
        },
        sulfiteDeclaration: {
          present: false,
          confidence: 0.06
        },
        appellation: {
          present: false,
          confidence: 0.12
        },
        vintage: {
          present: false,
          confidence: 0.11
        },
        governmentWarning: {
          present: false,
          confidence: 0.18
        },
        varietals: []
      },
      summary: 'Low-confidence extraction completed without application data.'
    });

    const server = await startServer({ extractor });
    registerServer(server);

    const response = await postReviewExtraction(server, {
      fields: null
    });

    expect(response.status).toBe(200);

    const payload = reviewExtractionSchema.parse(await response.json());

    expect(payload.standalone).toBe(true);
    expect(payload.noPersistence).toBe(true);
    expect(extractor).toHaveBeenCalledTimes(1);
  });

  it('maps extractor failures to structured errors on the extraction route', async () => {
    const extractor = vi.fn().mockRejectedValue({
      status: 503,
      error: {
        kind: 'adapter',
        message: 'Cloud label reading is not set up on this workstation. Contact your administrator.',
        retryable: false
      }
    });

    const server = await startServer({ extractor });
    registerServer(server);

    const response = await postReviewExtraction(server);

    expect(response.status).toBe(503);

    const payload = reviewErrorSchema.parse(await response.json());

    expect(payload.kind).toBe('adapter');
    expect(payload.retryable).toBe(false);
  });

  it('returns the warning check contract from the warning route', async () => {
    const extractor = vi.fn().mockResolvedValue({
      id: 'extract-demo-001',
      model: 'gpt-5.4',
      beverageType: 'distilled-spirits',
      beverageTypeSource: 'class-type',
      modelBeverageTypeHint: 'distilled-spirits',
      standalone: true,
      hasApplicationData: false,
      noPersistence: true,
      imageQuality: {
        score: 0.95,
        state: 'ok',
        issues: []
      },
      warningSignals: {
        prefixAllCaps: {
          status: 'yes',
          confidence: 0.98
        },
        prefixBold: {
          status: 'yes',
          confidence: 0.91
        },
        continuousParagraph: {
          status: 'yes',
          confidence: 0.9
        },
        separateFromOtherContent: {
          status: 'yes',
          confidence: 0.88
        }
      },
      fields: {
        brandName: {
          present: true,
          value: 'North Ridge',
          confidence: 0.78
        },
        fancifulName: {
          present: false,
          confidence: 0.1
        },
        classType: {
          present: true,
          value: 'Vodka',
          confidence: 0.82
        },
        alcoholContent: {
          present: true,
          value: '40% Alc./Vol.',
          confidence: 0.81
        },
        netContents: {
          present: true,
          value: '1 L',
          confidence: 0.8
        },
        applicantAddress: {
          present: false,
          confidence: 0.08
        },
        countryOfOrigin: {
          present: false,
          confidence: 0.07
        },
        ageStatement: {
          present: false,
          confidence: 0.05
        },
        sulfiteDeclaration: {
          present: false,
          confidence: 0.06
        },
        appellation: {
          present: false,
          confidence: 0.12
        },
        vintage: {
          present: false,
          confidence: 0.11
        },
        governmentWarning: {
          present: true,
          value:
            'Government Warning. (1) According to the surgeon general, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
          confidence: 0.96
        },
        varietals: []
      },
      summary: 'Structured extraction completed successfully.'
    });

    const server = await startServer({ extractor });
    registerServer(server);

    const response = await postReviewWarning(server, {
      fields: null
    });

    expect(response.status).toBe(200);

    const payload = checkReviewSchema.parse(await response.json());

    expect(payload.id).toBe('government-warning');
    expect(payload.status).toBe('pass');
    expect(payload.warning?.subChecks.map((subCheck) => subCheck.id)).toEqual([
      'present',
      'exact-text',
      'uppercase-bold-heading',
      'continuous-paragraph',
      'legibility'
    ]);
    expect(payload.warning?.subChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'exact-text', status: 'pass' }),
        expect.objectContaining({ id: 'uppercase-bold-heading', status: 'review' })
      ])
    );
    expect(extractor).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported label file types with a structured error', async () => {
    const server = await startServer();
    registerServer(server);

    const response = await postReview(server, {
      file: buildLabelFile({ name: 'label.heic', type: 'image/heic' })
    });

    expect(response.status).toBe(415);

    const payload = reviewErrorSchema.parse(await response.json());

    expect(payload.kind).toBe('validation');
    expect(payload.retryable).toBe(false);
  });

  it('rejects oversized label files with a structured error', async () => {
    const server = await startServer();
    registerServer(server);

    const response = await postReview(server, {
      file: buildLabelFile({ size: MAX_LABEL_UPLOAD_BYTES + 1 })
    });

    expect(response.status).toBe(413);

    const payload = reviewErrorSchema.parse(await response.json());

    expect(payload.message).toContain('10 MB');
    expect(payload.retryable).toBe(false);
  });

  it('rejects malformed fields payloads', async () => {
    const server = await startServer();
    registerServer(server);

    const response = await postReview(server, {
      fields: '{not-valid-json'
    });

    expect(response.status).toBe(400);

    const payload = reviewErrorSchema.parse(await response.json());

    expect(payload.kind).toBe('validation');
    expect(payload.message).toContain('application fields');
  });

  it('rejects review requests without a label file', async () => {
    const server = await startServer();
    registerServer(server);

    const response = await postReview(server, {
      file: null
    });

    expect(response.status).toBe(400);

    const payload = reviewErrorSchema.parse(await response.json());

    expect(payload.kind).toBe('validation');
    expect(payload.message).toContain('label image');
  });
});
