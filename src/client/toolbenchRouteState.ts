import type { Mode } from './appTypes';

export type ToolbenchAssetKind = 'image' | 'csv';

export type ToolbenchAssetRoute =
  | 'single-image'
  | 'batch-image'
  | 'batch-csv';

export function resolveToolbenchAssetRoute(input: {
  mode: Mode;
  kind: ToolbenchAssetKind;
}): ToolbenchAssetRoute {
  if (input.kind === 'csv') {
    return 'batch-csv';
  }

  return input.mode === 'batch' ? 'batch-image' : 'single-image';
}
