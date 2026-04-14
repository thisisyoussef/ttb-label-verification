import { helpManifestSchema, type HelpManifest } from '../shared/contracts/help';
import { LOCAL_HELP_MANIFEST } from '../shared/help-fixture';
import { resetHelpManifest, setHelpManifest } from './helpManifest';

type HelpManifestFetcher = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

interface LoadRemoteHelpManifestOptions {
  fetcher?: HelpManifestFetcher;
  locale?: string;
}

interface LoadRemoteHelpManifestResult {
  source: 'remote' | 'fixture';
  manifest: HelpManifest;
}

export async function fetchHelpManifest(
  fetcher: HelpManifestFetcher = fetch,
  locale = 'en'
) {
  const response = await fetcher(`/api/help/manifest?locale=${locale}`);

  if (!response.ok) {
    throw new Error(`Help manifest request failed with status ${response.status}.`);
  }

  return helpManifestSchema.parse(await response.json());
}

export async function loadRemoteHelpManifest(
  options: LoadRemoteHelpManifestOptions = {}
): Promise<LoadRemoteHelpManifestResult> {
  try {
    const manifest = await fetchHelpManifest(
      options.fetcher,
      options.locale ?? 'en'
    );
    setHelpManifest(manifest);
    return { source: 'remote', manifest };
  } catch {
    resetHelpManifest();
    return { source: 'fixture', manifest: LOCAL_HELP_MANIFEST };
  }
}
