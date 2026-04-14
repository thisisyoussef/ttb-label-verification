type ThumbnailPalette = {
  bg: string;
  band: string;
  text: string;
  accent: string;
};

// These hex values are image content embedded in SVG data URIs (mock bottle/can
// artwork), not UI theme tokens. UI surfaces still use tailwind tokens only.
const PALETTES: ThumbnailPalette[] = [
  { bg: '#3b2a1a', band: '#1d1309', text: '#f2e2c2', accent: '#c89b5e' },
  { bg: '#1b3a3a', band: '#0e2425', text: '#d8f0ef', accent: '#78c6be' },
  { bg: '#4a1f28', band: '#2b0f15', text: '#f4d7dc', accent: '#e08696' },
  { bg: '#1f2f4a', band: '#0f1828', text: '#d8e1f4', accent: '#88a9e0' },
  { bg: '#2d3b1e', band: '#131a0c', text: '#e5f0cc', accent: '#a7c868' },
  { bg: '#3a2f4a', band: '#1d172a', text: '#ead7f2', accent: '#b291d6' },
  { bg: '#2c2c2c', band: '#141414', text: '#e4e4e4', accent: '#8a8a8a' }
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickPalette(seed: string): ThumbnailPalette {
  const entry = PALETTES[hashString(seed) % PALETTES.length];
  if (!entry) {
    return PALETTES[0]!;
  }
  return entry;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fitMonogram(source: string): string {
  const letters = source
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase());
  if (letters.length === 0) return '••';
  if (letters.length === 1) return letters[0]!;
  return `${letters[0]}${letters[letters.length - 1]}`;
}

export interface LabelThumbnailInput {
  brandName: string;
  classType: string;
}

export function buildLabelThumbnail({
  brandName,
  classType
}: LabelThumbnailInput): string {
  const palette = pickPalette(`${brandName}|${classType}`);
  const monogram = escapeXml(fitMonogram(brandName || classType || '••'));
  const brandLine = escapeXml(truncate(brandName || 'Untitled', 18));
  const classLine = escapeXml(truncate(classType || 'Label', 22));

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160" role="img" aria-label="${brandLine}">
      <rect x="0" y="0" width="120" height="160" rx="8" fill="${palette.bg}" />
      <rect x="0" y="46" width="120" height="28" fill="${palette.band}" />
      <text x="60" y="36" text-anchor="middle" font-family="'IBM Plex Mono', ui-monospace, monospace" font-size="22" font-weight="700" fill="${palette.text}">${monogram}</text>
      <text x="60" y="66" text-anchor="middle" font-family="'Public Sans', system-ui, sans-serif" font-size="10" font-weight="700" fill="${palette.text}" letter-spacing="1.5">${brandLine.toUpperCase()}</text>
      <rect x="18" y="86" width="84" height="2" fill="${palette.accent}" />
      <text x="60" y="106" text-anchor="middle" font-family="'Public Sans', system-ui, sans-serif" font-size="8" fill="${palette.text}" opacity="0.9">${classLine}</text>
      <rect x="18" y="128" width="84" height="14" rx="1" fill="${palette.band}" opacity="0.85" />
      <text x="60" y="138" text-anchor="middle" font-family="'IBM Plex Mono', ui-monospace, monospace" font-size="6" fill="${palette.accent}" letter-spacing="1">GOVERNMENT WARNING</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}…`;
}
