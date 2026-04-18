import { buildLabelThumbnail } from '../labelThumbnail';
import { buildReportForScenario } from '../resultScenarios';
import type { SeedScenario } from '../scenarios';
import type { LabelImage, UIVerificationReport } from '../types';

// 1×1 PNG fallback used when a tour scenario has no imageAsset
// configured. Scenarios that reference real cola-cloud assets (like
// the default tour scenario) fetch the actual image bytes in
// `buildTourDemoImage` instead.
const FALLBACK_DEMO_IMAGE_BYTES = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
  0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12, 2, 0, 0, 0, 11, 73, 68, 65, 84, 120, 218,
  99, 252, 255, 31, 0, 3, 3, 2, 0, 239, 167, 43, 183, 0, 0, 0, 0, 73, 69, 78, 68,
  174, 66, 96, 130
]);

function buildFallbackLabelImage(scenario: SeedScenario): LabelImage {
  return {
    file: new File([FALLBACK_DEMO_IMAGE_BYTES], `${scenario.id}.png`, {
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

function guessMimeFromExtension(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'webp') return 'image/webp';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function formatSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Load the tour's label. When the scenario has an `imageAsset`, we
 * fetch the real image bytes from the server's label-image endpoint so
 * the tour shows a real COLA label instead of a synthetic 1×1 PNG +
 * generated thumbnail. Falls back to the stub when the network fetch
 * fails or the scenario isn't configured with an asset — the tour is
 * always navigable, even offline.
 *
 * NOTE: async. Callers must await. The tour flow only invokes this on
 * user click ("Show sample results", "See failing example", "Load
 * tour scenario"), so the extra I/O is fine — real image + real
 * fields is strictly more valuable than instant load.
 */
export async function buildTourDemoImage(
  scenario: SeedScenario
): Promise<LabelImage> {
  if (!scenario.imageAsset) {
    return buildFallbackLabelImage(scenario);
  }
  const { source, filename } = scenario.imageAsset;
  try {
    const res = await fetch(`/api/eval/label-image/${source}/${filename}`);
    if (!res.ok) throw new Error(`asset HTTP ${res.status}`);
    const blob = await res.blob();
    const mime = guessMimeFromExtension(filename);
    const file = new File([blob], filename, { type: mime });
    const previewUrl = URL.createObjectURL(blob);
    return {
      file,
      previewUrl,
      sizeLabel: formatSizeLabel(blob.size),
      // Mark as a demo image so the refine-pass guard in
      // useSingleReviewFlow skips firing a server refine call during
      // the canned tour flow.
      demoScenarioId: scenario.id
    };
  } catch {
    // Server unreachable (e.g. Vite-only dev, or transient network
    // blip). Fall back to the synthetic stub so the tour still runs.
    return buildFallbackLabelImage(scenario);
  }
}

export function resolveTourDemoReviewReport(
  image: LabelImage | null
): UIVerificationReport | null {
  if (!image?.demoScenarioId) {
    return null;
  }

  return buildReportForScenario(image.demoScenarioId);
}
