import { describe, expect, it } from 'vitest';

import {
  batchDashboardResponseSchema,
  batchExportPayloadSchema,
  batchPreflightResponseSchema,
  batchStreamFrameSchema,
  MAX_LABEL_UPLOAD_BYTES,
  WARNING_SUB_CHECK_IDS,
  getSeedVerificationReport,
  healthResponseSchema,
  reviewExtractionSchema,
  reviewErrorSchema,
  reviewIntakeFieldsSchema,
  verificationReportSchema
} from './review';

describe('review contract', () => {
  it('parses the approved intake field payload shape', () => {
    const payload = reviewIntakeFieldsSchema.parse({
      beverageType: 'wine',
      brandName: 'Heritage Hill',
      fancifulName: '',
      classType: 'Red Wine',
      alcoholContent: '13.5% Alc./Vol.',
      netContents: '750 mL',
      applicantAddress: 'Heritage Hill Cellars, Napa, CA',
      origin: 'domestic',
      country: '',
      formulaId: '',
      appellation: '',
      vintage: '2021',
      varietals: [
        { name: 'Cabernet Sauvignon', percentage: '75' },
        { name: 'Merlot', percentage: '25' }
      ]
    });

    expect(payload.beverageType).toBe('wine');
    expect(payload.varietals).toHaveLength(2);
  });

  it('parses the structured review error shape', () => {
    const payload = reviewErrorSchema.parse({
      kind: 'validation',
      message: 'That file is too large. The limit is 10 MB.',
      retryable: false
    });

    expect(payload.kind).toBe('validation');
    expect(payload.retryable).toBe(false);
  });

  it('parses the seed verification report', () => {
    const report = verificationReportSchema.parse(getSeedVerificationReport());

    expect(report.noPersistence).toBe(true);
    expect(report.latencyBudgetMs).toBeLessThanOrEqual(5000);
    expect(report.verdict).toBe('review');
    expect(report.counts.review).toBeGreaterThan(0);
    expect(report.crossFieldChecks).toHaveLength(1);
  });

  it('keeps the government warning out of pass until real validation exists', () => {
    const report = getSeedVerificationReport();
    const warning = report.checks.find((check) => check.id === 'government-warning');

    expect(warning).toBeDefined();
    expect(warning?.status).toBe('review');
    expect(warning?.severity).toBe('blocker');
    expect(warning?.warning?.subChecks.map((subCheck) => subCheck.id)).toEqual(
      WARNING_SUB_CHECK_IDS
    );
  });

  it('derives a standalone seed report when application data is omitted', () => {
    const report = verificationReportSchema.parse(
      getSeedVerificationReport({ standalone: true })
    );

    expect(report.standalone).toBe(true);
    expect(report.checks[0]?.comparison?.status).toBe('not-applicable');
    expect(report.crossFieldChecks[0]?.status).toBe('info');
  });

  it('overlays submitted application values onto the seeded comparison rows', () => {
    const report = verificationReportSchema.parse(
      getSeedVerificationReport({
        applicationFields: {
          brandName: 'My Custom Brand',
          alcoholContent: '45% Alc./Vol.'
        }
      })
    );

    const brand = report.checks.find((check) => check.id === 'brand-name');
    const alcohol = report.checks.find((check) => check.id === 'alcohol-content');

    expect(report.standalone).toBe(false);
    expect(brand?.applicationValue).toBe('My Custom Brand');
    expect(brand?.comparison?.status).toBe('value-mismatch');
    expect(alcohol?.applicationValue).toBe('45% Alc./Vol.');
    expect(alcohol?.comparison?.status).toBe('case-mismatch');
  });

  it('supports standalone reports with comparison skips', () => {
    const payload = verificationReportSchema.parse({
      id: 'standalone-demo',
      mode: 'single-label',
      beverageType: 'wine',
      verdict: 'review',
      standalone: true,
      extractionQuality: {
        globalConfidence: 0.81,
        state: 'ok'
      },
      counts: {
        pass: 1,
        review: 1,
        fail: 0
      },
      checks: [
        {
          id: 'brand-name',
          label: 'Brand name',
          status: 'pass',
          severity: 'note',
          summary: 'Extracted label text is available without application data.',
          details: 'Standalone mode omits application comparisons when no application payload exists.',
          confidence: 0.9,
          citations: [],
          extractedValue: 'North Ridge',
          comparison: {
            status: 'not-applicable',
            note: 'No application value was supplied for standalone review.'
          }
        }
      ],
      crossFieldChecks: [
        {
          id: 'vintage-requires-appellation',
          label: 'Vintage requires appellation',
          status: 'info',
          severity: 'note',
          summary: 'Cross-field dependency skipped in standalone mode.',
          details: 'Application-backed dependency checks can be skipped when no application form was provided.',
          confidence: 1,
          citations: []
        }
      ],
      latencyBudgetMs: 5000,
      noPersistence: true,
      summary: 'Standalone review preserves extraction evidence without application comparisons.'
    });

    expect(payload.standalone).toBe(true);
    expect(payload.checks[0]?.comparison?.status).toBe('not-applicable');
    expect(payload.crossFieldChecks[0]?.status).toBe('info');
  });

  it('supports no-text-extracted reports with empty checks', () => {
    const payload = verificationReportSchema.parse({
      id: 'no-text-demo',
      mode: 'single-label',
      beverageType: 'unknown',
      verdict: 'review',
      verdictSecondary: 'Low extraction confidence — review carefully.',
      standalone: false,
      extractionQuality: {
        globalConfidence: 0.12,
        state: 'no-text-extracted',
        note: 'No readable text could be extracted from the label image.'
      },
      counts: {
        pass: 0,
        review: 0,
        fail: 0
      },
      checks: [],
      crossFieldChecks: [],
      latencyBudgetMs: 5000,
      noPersistence: true,
      summary: 'No text could be extracted from the label.'
    });

    expect(payload.extractionQuality.state).toBe('no-text-extracted');
    expect(payload.checks).toHaveLength(0);
    expect(payload.counts.fail).toBe(0);
  });

  it('models the health endpoint as a no-persistence scaffold', () => {
    const payload = healthResponseSchema.parse({
      status: 'ok',
      service: 'ttb-label-verification',
      mode: 'scaffold',
      responsesApi: true,
      store: false,
      timestamp: new Date().toISOString()
    });

    expect(payload.responsesApi).toBe(true);
    expect(payload.store).toBe(false);
  });

  it('keeps the upload size limit aligned to the approved 10 MB cap', () => {
    expect(MAX_LABEL_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it('parses the extraction contract for the live model pass', () => {
    const payload = reviewExtractionSchema.parse({
      id: 'extract-demo-001',
      model: 'gpt-5.4',
      beverageType: 'wine',
      beverageTypeSource: 'class-type',
      modelBeverageTypeHint: 'wine',
      standalone: true,
      hasApplicationData: false,
      noPersistence: true,
      imageQuality: {
        score: 0.81,
        state: 'ok',
        issues: []
      },
      warningSignals: {
        prefixAllCaps: {
          status: 'yes',
          confidence: 0.92
        },
        prefixBold: {
          status: 'uncertain',
          confidence: 0.41,
          note: 'Typeface weight is hard to confirm from the image.'
        },
        continuousParagraph: {
          status: 'yes',
          confidence: 0.87
        },
        separateFromOtherContent: {
          status: 'yes',
          confidence: 0.71
        }
      },
      fields: {
        brandName: {
          present: true,
          value: 'Heritage Hill',
          confidence: 0.97
        },
        fancifulName: {
          present: false,
          confidence: 0.22
        },
        classType: {
          present: true,
          value: 'Red Wine',
          confidence: 0.95
        },
        alcoholContent: {
          present: true,
          value: '13.5% Alc./Vol.',
          confidence: 0.89
        },
        netContents: {
          present: true,
          value: '750 mL',
          confidence: 0.93
        },
        applicantAddress: {
          present: true,
          value: 'Heritage Hill Cellars, Napa, CA',
          confidence: 0.83
        },
        countryOfOrigin: {
          present: false,
          confidence: 0.12
        },
        ageStatement: {
          present: false,
          confidence: 0.09
        },
        sulfiteDeclaration: {
          present: false,
          confidence: 0.18
        },
        appellation: {
          present: true,
          value: 'Napa Valley',
          confidence: 0.78
        },
        vintage: {
          present: true,
          value: '2021',
          confidence: 0.74
        },
        governmentWarning: {
          present: true,
          value: 'GOVERNMENT WARNING: ...',
          confidence: 0.69,
          note: 'Readable, but the text is small.'
        },
        varietals: [
          {
            name: 'Cabernet Sauvignon',
            percentage: '75%',
            confidence: 0.72
          }
        ]
      },
      summary: 'Structured extraction for a wine label with clear primary fields.'
    });

    expect(payload.beverageTypeSource).toBe('class-type');
    expect(payload.fields.varietals).toHaveLength(1);
    expect(payload.warningSignals.prefixBold.status).toBe('uncertain');
  });

  it('parses the batch preflight payload shape', () => {
    const payload = batchPreflightResponseSchema.parse({
      batchSessionId: 'batch-live-001',
      csvHeaders: [
        'filename',
        'brand_name',
        'class_type',
        'alcohol_content',
        'net_contents'
      ],
      csvRows: [
        {
          id: 'row-1',
          rowIndex: 1,
          filenameHint: 'old-oak-bourbon.jpg',
          brandName: 'Old Oak Bourbon',
          classType: 'Kentucky Straight Bourbon'
        }
      ],
      matching: {
        matched: [
          {
            imageId: 'image-1',
            row: {
              id: 'row-1',
              rowIndex: 1,
              filenameHint: 'old-oak-bourbon.jpg',
              brandName: 'Old Oak Bourbon',
              classType: 'Kentucky Straight Bourbon'
            },
            source: 'filename'
          }
        ],
        ambiguous: [],
        unmatchedImageIds: [],
        unmatchedRowIds: []
      },
      fileErrors: []
    });

    expect(payload.batchSessionId).toBe('batch-live-001');
    expect(payload.csvRows[0]?.brandName).toBe('Old Oak Bourbon');
  });

  it('parses batch stream frames and export payloads', () => {
    const frame = batchStreamFrameSchema.parse({
      type: 'summary',
      total: 2,
      pass: 1,
      review: 0,
      fail: 0,
      error: 1,
      dashboardHandle: {
        sessionId: 'batch-live-001'
      }
    });

    const dashboard = batchDashboardResponseSchema.parse({
      batchSessionId: 'batch-live-001',
      phase: 'complete',
      totals: {
        started: 2,
        done: 2
      },
      summary: {
        pass: 1,
        review: 0,
        fail: 0,
        error: 1
      },
      rows: [
        {
          rowId: 'row-1',
          reportId: 'report-1',
          imageId: 'image-1',
          filename: 'old-oak-bourbon.jpg',
          brandName: 'Old Oak Bourbon',
          classType: 'Kentucky Straight Bourbon',
          beverageType: 'distilled-spirits',
          status: 'pass',
          previewUrl: null,
          isPdf: false,
          sizeLabel: '2.8 MB',
          issues: {
            blocker: 0,
            major: 0,
            minor: 0,
            note: 0
          },
          confidenceState: 'ok',
          errorMessage: null,
          completedOrder: 1
        }
      ]
    });

    const exportPayload = batchExportPayloadSchema.parse({
      generatedAt: new Date().toISOString(),
      phase: 'complete',
      totals: {
        started: 2,
        done: 2
      },
      summary: {
        pass: 1,
        review: 0,
        fail: 0,
        error: 1
      },
      rows: dashboard.rows,
      reports: {
        'report-1': getSeedVerificationReport()
      },
      noPersistence: true
    });

    expect(frame.type).toBe('summary');
    expect(dashboard.rows[0]?.status).toBe('pass');
    expect(exportPayload.noPersistence).toBe(true);
  });
});
