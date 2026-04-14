import { buildLabelThumbnail } from './labelThumbnail';
import { buildReportForScenario } from './resultScenarios';
import type { SeedScenario } from './scenarios';
import type { LabelImage, UIVerificationReport } from './types';

const DEMO_IMAGE_BYTES = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
  0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218,
  99, 252, 255, 31, 0, 3, 3, 2, 0, 239, 167, 43, 183, 0, 0, 0, 0, 73, 69, 78, 68,
  174, 66, 96, 130
]);

export function buildTourDemoImage(scenario: SeedScenario): LabelImage {
  return {
    file: new File([DEMO_IMAGE_BYTES], `${scenario.id}.png`, {
      type: 'image/png'
    }),
    previewUrl: buildLabelThumbnail({
      brandName: scenario.fields.brandName || scenario.title,
      classType: scenario.fields.classType || scenario.description
    }),
    sizeLabel: '1 KB',
    demoScenarioId: scenario.id
  };
}

export function resolveTourDemoReviewReport(
  image: LabelImage | null
): UIVerificationReport | null {
  if (!image?.demoScenarioId) {
    return null;
  }

  return buildReportForScenario(image.demoScenarioId);
}
