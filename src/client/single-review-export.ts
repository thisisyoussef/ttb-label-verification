import type {
  BeverageSelection,
  LabelImage,
  UIVerificationReport
} from './types';

export function exportReviewResults(input: {
  image: LabelImage | null;
  beverage: BeverageSelection;
  report: UIVerificationReport;
}) {
  const payload = {
    generatedAt: new Date().toISOString(),
    imageName: input.image?.file.name ?? null,
    beverageType: input.beverage,
    report: input.report
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ttb-label-verification-${input.report.id}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
