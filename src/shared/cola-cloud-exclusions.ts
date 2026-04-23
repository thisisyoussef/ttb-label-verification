const BLOCKED_COLA_CLOUD_TTB_IDS = new Set([
  '26107001000011'
]);

export function isBlockedColaCloudTtbId(ttbId: string | null | undefined): boolean {
  if (!ttbId) {
    return false;
  }

  return BLOCKED_COLA_CLOUD_TTB_IDS.has(ttbId.trim());
}
