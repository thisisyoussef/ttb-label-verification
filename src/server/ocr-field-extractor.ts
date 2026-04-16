/**
 * Pure OCR + regex field extraction — no LLM, no image, no pollution.
 *
 * Extracts structured fields from raw Tesseract OCR text using regex
 * patterns and heuristics. Only returns fields it can confidently identify.
 * Fields it can't find are marked present=false — never hallucinated.
 *
 * This replaces the VLM for text field extraction. The VLM is only used
 * for visual signals (bold, caps, layout) in a separate image-only call.
 */

import type {
  BeverageType,
  ReviewExtractionFields,
  WarningVisualSignals
} from '../shared/contracts/review';
import type { ReviewExtractionModelOutput, RawImageQualityAssessment } from './review-extraction';

// ─── Field Extraction Patterns ────────────────────────────────────────

/** Extract ABV/alcohol content from OCR text. */
function extractAlcoholContent(text: string): { value: string; confidence: number } | null {
  // Pattern 1: "X% Alc./Vol." and variants
  const alcVol = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:ALC\.?(?:\s*\/\s*|\s+BY\s+)VOL\.?)/i);
  if (alcVol) return { value: alcVol[0].trim(), confidence: 0.95 };

  // Pattern 2: "ALC/VOL X%" or "ALC. X% VOL"
  const alcPrefix = text.match(/ALC\.?\s*(?:\/\s*)?(?:BY\s+)?VOL\.?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (alcPrefix) return { value: alcPrefix[0].trim(), confidence: 0.90 };

  // Pattern 3: "X% by vol" or "by vol. X%"
  const byVol = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:by\s+vol\.?|BY\s+VOL\.?)/i)
    ?? text.match(/(?:by\s+vol\.?)\s*(\d+(?:\.\d+)?)\s*%/i);
  if (byVol) return { value: byVol[0].trim(), confidence: 0.88 };

  // Pattern 4: "X Proof" → convert to ABV. Lower confidence because
  // proof statements are easily misread by OCR (digit confusion).
  const proof = text.match(/(\d+(?:\.\d+)?)\s*PROOF/i);
  if (proof) {
    const abv = Number(proof[1]) / 2;
    return { value: `${abv}% Alc./Vol. (${proof[0].trim()})`, confidence: 0.70 };
  }

  // Pattern 5: bare "X%" near alcohol-related context words
  const lines = text.split('\n');
  for (const line of lines) {
    if (/alc|vol|proof|spirit|wine|beer|ale|lager/i.test(line)) {
      const pct = line.match(/(\d+(?:\.\d+)?)\s*%/);
      if (pct) return { value: pct[0].trim(), confidence: 0.70 };
    }
  }

  return null;
}

/** Extract net contents from OCR text. */
function extractNetContents(text: string): { value: string; confidence: number } | null {
  // Pattern: volume + unit
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(mL|ml|ML)\b/,
    /(\d+(?:\.\d+)?)\s*FL\.?\s*OZ\.?/i,
    /(\d+(?:\.\d+)?)\s*(?:PINT|pint)s?\b/,
    /(\d+(?:\.\d+)?)\s*(?:L|l|LITER|LITRE)s?\b/,
    /(\d+(?:\.\d+)?)\s*(?:cL|cl|CL)\b/,
    /(\d+(?:\.\d+)?)\s*(?:GAL|gal|GALLON)s?\b/i,
    /NET\s+CONT(?:ENTS?)?\.?\s*[:.]?\s*(.+)/i,
    /(\d+)\s*PINT\s*\((\d+)\s*FL\.?\s*OZ\.?\)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return { value: m[0].trim(), confidence: 0.90 };
  }

  return null;
}

/** Extract government warning from OCR text. */
function extractGovernmentWarning(text: string): { value: string; confidence: number } | null {
  const match = text.match(/GOVERNMENT\s*WARNING[\s\S]*/i);
  if (!match) return null;

  const warning = match[0]
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Require at least some of the canonical text to be present
  if (warning.length < 50) return null;
  if (!/surgeon\s*general/i.test(warning)) return null;

  return { value: warning, confidence: 0.85 };
}

/** Extract brand name — first prominent text line. */
function extractBrandName(text: string): { value: string; confidence: number } | null {
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 2 && l.length <= 50);

  // Skip common non-brand lines
  const skipPatterns = /^(NET\s+CONT|GOVERNMENT|ALC|PROOF|\d+%|\d+\s*(mL|FL|OZ|L)\b|BREWED|BOTTLED|PRODUCED|IMPORTED|LIMITED|EDITION)/i;

  for (const line of lines) {
    if (skipPatterns.test(line)) continue;
    // Prefer all-caps lines (brand names are often in caps)
    if (line === line.toUpperCase() && /[A-Z]/.test(line)) {
      return { value: line, confidence: 0.70 };
    }
  }

  // Fallback: first non-skipped line
  for (const line of lines) {
    if (!skipPatterns.test(line) && /[A-Za-z]/.test(line)) {
      return { value: line, confidence: 0.55 };
    }
  }

  return null;
}

/** Extract class/type from OCR text. */
function extractClassType(text: string): { value: string; confidence: number } | null {
  const typePatterns = [
    { pat: /\b(INDIA\s+PALE\s+ALE|IPA)\b/i, conf: 0.92 },
    { pat: /\b(PALE\s+ALE|AMBER\s+ALE|BROWN\s+ALE|RED\s+ALE|GOLDEN\s+ALE|ORIGINAL\s+ALE)\b/i, conf: 0.90 },
    { pat: /\b(STOUT|PORTER|LAGER|PILSNER|HEFEWEIZEN|SAISON)\b/i, conf: 0.90 },
    { pat: /\b(ALE|BEER|MALT\s+BEVERAGE)\b/i, conf: 0.85 },
    { pat: /\b(BOURBON|WHISKEY|WHISKY|VODKA|GIN|RUM|TEQUILA|BRANDY|COGNAC)\b/i, conf: 0.92 },
    { pat: /\b(KENTUCKY\s+STRAIGHT\s+BOURBON(?:\s+WHISKE?Y)?)\b/i, conf: 0.95 },
    { pat: /\b(SPIRITS?\s+DISTILLED\s+FROM\b[^.]*)/i, conf: 0.88 },
    { pat: /\b(RED\s+WINE|WHITE\s+WINE|ROSE|ROSÉ|SPARKLING\s+WINE)\b/i, conf: 0.90 },
    { pat: /\b(CABERNET|MERLOT|CHARDONNAY|RIESLING|PINOT|SAUVIGNON|SEMILLON|SYRAH|SHIRAZ)\b/i, conf: 0.88 },
    { pat: /\b(CHAMPAGNE|PROSECCO|CAVA|BRUT)\b/i, conf: 0.90 },
    { pat: /\b(LIQUEUR|CORDIAL|CREAM\s+LIQUEUR)\b/i, conf: 0.88 },
  ];

  for (const { pat, conf } of typePatterns) {
    const m = text.match(pat);
    if (m) return { value: m[0].trim(), confidence: conf };
  }

  return null;
}

/** Extract country of origin. */
function extractCountryOfOrigin(text: string): { value: string; confidence: number } | null {
  const patterns = [
    { pat: /PRODUCT\s+OF\s+([A-Z][A-Za-z\s]+)/i, conf: 0.92 },
    { pat: /PRODUCED?\s+IN\s+([A-Z][A-Za-z\s]+)/i, conf: 0.88 },
    { pat: /IMPORTED\s+(?:FROM|BY)\s+([A-Z][A-Za-z\s]+)/i, conf: 0.80 },
    { pat: /BOTTLED\s+IN\s+([A-Z][A-Za-z\s]+)/i, conf: 0.80 },
    { pat: /DISTILLED\s+IN\s+([A-Z][A-Za-z\s]+)/i, conf: 0.85 },
  ];

  for (const { pat, conf } of patterns) {
    const m = text.match(pat);
    if (m) return { value: m[1].trim().slice(0, 30), confidence: conf };
  }

  return null;
}

/** Extract applicant/producer address. */
function extractAddress(text: string): { value: string; confidence: number } | null {
  // Look for city + state patterns
  const cityState = text.match(/\b([A-Z][A-Za-z\s]+),\s*([A-Z]{2})\b/);
  if (cityState) {
    // Get the surrounding line for context
    const lineIdx = text.indexOf(cityState[0]);
    const lineStart = text.lastIndexOf('\n', lineIdx) + 1;
    const lineEnd = text.indexOf('\n', lineIdx + cityState[0].length);
    const line = text.slice(lineStart, lineEnd > 0 ? lineEnd : undefined).trim();
    if (line.length > 5 && line.length < 150) {
      return { value: line, confidence: 0.75 };
    }
    return { value: cityState[0].trim(), confidence: 0.70 };
  }

  return null;
}

/** Infer beverage type from OCR text. */
function inferBeverageType(text: string): BeverageType {
  const lower = text.toLowerCase();
  if (/\b(bourbon|whiskey|whisky|vodka|gin|rum|tequila|brandy|cognac|spirits?|liqueur|cordial|proof)\b/.test(lower)) return 'distilled-spirits';
  if (/\b(wine|vin|vino|champagne|prosecco|cabernet|merlot|chardonnay|riesling|pinot|sauvignon|semillon)\b/.test(lower)) return 'wine';
  if (/\b(ale|beer|lager|stout|porter|ipa|malt|pilsner|hefeweizen|brewed)\b/.test(lower)) return 'malt-beverage';
  return 'unknown';
}

// ─── Main Extractor ───────────────────────────────────────────────────

/**
 * Extract structured fields from OCR text using regex patterns only.
 * No LLM call, no image access, zero pollution risk.
 *
 * Returns null if OCR text is too short to be useful.
 */
export function extractFieldsFromOcrText(
  ocrText: string
): ReviewExtractionModelOutput | null {
  if (!ocrText || ocrText.length < 20) return null;

  const abv = extractAlcoholContent(ocrText);
  const net = extractNetContents(ocrText);
  const warning = extractGovernmentWarning(ocrText);
  const brand = extractBrandName(ocrText);
  const classType = extractClassType(ocrText);
  const country = extractCountryOfOrigin(ocrText);
  const address = extractAddress(ocrText);
  const beverageType = inferBeverageType(ocrText);

  const mkField = (result: { value: string; confidence: number } | null) => ({
    present: result !== null,
    value: result?.value ?? undefined,
    confidence: result?.confidence ?? 0.1,
    note: result === null ? 'Not found in OCR text.' : undefined
  });

  const fields = {
    brandName: mkField(brand),
    fancifulName: { present: false, value: undefined, confidence: 0.1, note: 'Regex extraction does not identify fanciful names.' },
    classType: mkField(classType),
    alcoholContent: mkField(abv),
    netContents: mkField(net),
    applicantAddress: mkField(address),
    countryOfOrigin: mkField(country),
    ageStatement: { present: false, value: undefined, confidence: 0.1 },
    sulfiteDeclaration: { present: false, value: undefined, confidence: 0.1 },
    appellation: { present: false, value: undefined, confidence: 0.1 },
    vintage: { present: false, value: undefined, confidence: 0.1 },
    governmentWarning: mkField(warning),
    varietals: []
  } as unknown as ReviewExtractionFields;

  const warningSignals: WarningVisualSignals = {
    prefixAllCaps: { status: 'uncertain', confidence: 0.1 },
    prefixBold: { status: 'uncertain', confidence: 0.1 },
    continuousParagraph: { status: 'uncertain', confidence: 0.1 },
    separateFromOtherContent: { status: 'uncertain', confidence: 0.1 }
  };

  const imageQuality: RawImageQualityAssessment = {
    score: 0.7,
    issues: [],
    noTextDetected: ocrText.length < 10
  };

  return {
    beverageTypeHint: beverageType,
    fields,
    warningSignals,
    imageQuality,
    summary: `OCR-regex extraction: ${ocrText.length} chars processed. ABV:${abv ? 'found' : 'miss'} Net:${net ? 'found' : 'miss'} Warning:${warning ? 'found' : 'miss'} Brand:${brand ? 'found' : 'miss'} Class:${classType ? 'found' : 'miss'}`
  };
}
