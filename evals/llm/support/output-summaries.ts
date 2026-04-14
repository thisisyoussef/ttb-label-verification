import type {
  BatchDashboardResponse,
  CheckReview,
  ReviewExtraction,
  VerificationReport
} from '../../../src/shared/contracts/review';

function summarizeChecks(checks: CheckReview[]) {
  return checks.map((check) => ({
    id: check.id,
    status: check.status
  }));
}

export function summarizeReviewPayload(payload: VerificationReport) {
  return {
    verdict: payload.verdict,
    standalone: payload.standalone,
    noPersistence: payload.noPersistence,
    extractionQuality: payload.extractionQuality.state,
    counts: payload.counts,
    checks: summarizeChecks(payload.checks),
    crossFieldChecks: summarizeChecks(payload.crossFieldChecks),
    summary: payload.summary
  };
}

export function summarizeExtractionPayload(payload: ReviewExtraction) {
  const presentFieldIds = Object.entries(payload.fields)
    .filter(([fieldId, value]) => {
      if (Array.isArray(value)) {
        return fieldId === 'varietals' && value.length > 0;
      }

      return value.present;
    })
    .map(([fieldId]) => fieldId)
    .sort();

  return {
    beverageType: payload.beverageType,
    beverageTypeSource: payload.beverageTypeSource,
    standalone: payload.standalone,
    hasApplicationData: payload.hasApplicationData,
    noPersistence: payload.noPersistence,
    imageQualityState: payload.imageQuality.state,
    presentFieldIds
  };
}

export function summarizeWarningPayload(payload: CheckReview) {
  return {
    status: payload.status,
    noPersistence: true,
    subChecks:
      payload.warning?.subChecks.map((subCheck) => ({
        id: subCheck.id,
        status: subCheck.status
      })) ?? [],
    summary: payload.summary
  };
}

export function summarizeBatchSummary(payload: BatchDashboardResponse) {
  return {
    phase: payload.phase,
    summary: payload.summary,
    rows: payload.rows.map((row) => ({
      imageId: row.imageId,
      status: row.status,
      confidenceState: row.confidenceState
    }))
  };
}
