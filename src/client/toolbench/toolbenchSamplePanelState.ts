export type CapabilityProbeState =
  | 'loading'
  | 'available'
  | 'unavailable';

export type ToolbenchSampleSectionId =
  | 'random-sample'
  | 'capabilities-placeholder'
  | 'live-sample'
  | 'synthetic-sample'
  | 'sample-catalog';

export function resolveToolbenchSampleSectionIds(input: {
  liveAvailability: CapabilityProbeState;
  synthAvailability: CapabilityProbeState;
}): ToolbenchSampleSectionId[] {
  const ids: ToolbenchSampleSectionId[] = ['random-sample'];

  if (
    input.liveAvailability === 'loading' ||
    input.synthAvailability === 'loading'
  ) {
    ids.push('capabilities-placeholder');
  } else {
    if (input.liveAvailability === 'available') {
      ids.push('live-sample');
    }
    if (input.synthAvailability === 'available') {
      ids.push('synthetic-sample');
    }
  }

  ids.push('sample-catalog');
  return ids;
}
