import {
  helpManifestSchema,
  type HelpAnchorKey,
  type HelpManifest,
  type HelpShowMe,
  type HelpShowMeAction,
  type InfoPopover,
  type TourStep
} from '../shared/contracts/help';
import { LOCAL_HELP_MANIFEST } from '../shared/help-fixture';

export { LOCAL_HELP_MANIFEST };
export type {
  HelpAnchorKey,
  HelpManifest,
  HelpShowMe,
  HelpShowMeAction,
  InfoPopover,
  TourStep
};

let activeHelpManifest: HelpManifest = LOCAL_HELP_MANIFEST;

export function setHelpManifest(manifest: HelpManifest) {
  activeHelpManifest = helpManifestSchema.parse(manifest);
}

export function resetHelpManifest() {
  activeHelpManifest = LOCAL_HELP_MANIFEST;
}

export function findInfoPopover(
  anchorKey: HelpAnchorKey
): InfoPopover | undefined {
  return activeHelpManifest.infoPopovers.find(
    (entry) => entry.anchorKey === anchorKey
  );
}

export function getTourSteps(): TourStep[] {
  return activeHelpManifest.tourSteps;
}
