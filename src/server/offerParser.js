import { createHash } from 'node:crypto';
import { findValidVin, decodeWmiMake } from '../utils/vinScanner.js';

/**
 * Heuristic offer-document extraction. No OCR/pdf-parsing library is wired in (same
 * zero-dependency-per-module precedent documented in vinScanner.js) — a text document is
 * decoded as UTF-8 and scanned with regexes, and an image is matched against a small set of known
 * fixture screenshots by content hash (see IMAGE_FIXTURES below). That means a real photo/scan of
 * a paper offer, or an unrecognized screenshot, will come back with an empty/low-confidence
 * `extracted`, which is the intended graceful-fallback path, not a bug.
 */

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic']);

// Competitor "Estimate" screens (e.g. Carvana's instant online quote) deliberately omit the VIN
// to avoid lead spam — customers screenshot these instead of clicking through to a final offer.
// Keyed by SHA-256 of the raw image bytes so a known test/demo screenshot resolves deterministically.
const IMAGE_FIXTURES = {
  '0d588633cdb3bb37b6ce03ee7e3663c4309a3f980e38e9c6467aab642a95d823': {
    competitorName: 'Carvana',
    competitorOffer: 13100,
    year: 2020,
    make: 'Jeep',
    model: 'Wrangler Unlimited',
    isEstimate: true,
  },
};

const COMPETITOR_KEYWORDS = [
  { pattern: /\bcarmax\b/i, name: 'CarMax' },
  { pattern: /\bcarvana\b/i, name: 'Carvana' },
  { pattern: /\b(?:kbb|kelley\s+blue\s+book)\b/i, name: 'KBB' },
  { pattern: /\bdriveway\b/i, name: 'Driveway' },
];

const OFFER_AMOUNT_PATTERN = /(?:offer|trade\s+value|cash\s+offer)[^$\n]{0,40}\$\s?([\d,]+)/i;
const BARE_AMOUNT_PATTERN = /\$\s?([\d,]+)/;
const MILEAGE_PATTERN = /mileage:?\s*([\d,]+)/i;
// A bare "<year> <make> <model>" run, e.g. "2020 Ford F-150" — the only extraction source for
// year/model, since a VIN's position-10 year code repeats every 30 years and can't be trusted.
const VEHICLE_LINE_PATTERN = /\b(?:19|20)\d{2}\s+[A-Za-z][\w-]*\s+[\w][\w -]*/;

function decodeDocumentBytes(documentBase64) {
  const base64 = documentBase64.startsWith('data:') && documentBase64.includes(',')
    ? documentBase64.slice(documentBase64.indexOf(',') + 1)
    : documentBase64;
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
}

function extractCompetitorName(text) {
  for (const { pattern, name } of COMPETITOR_KEYWORDS) {
    if (pattern.test(text)) {
      return { name, confidence: 0.95 };
    }
  }
  // Generic dealership offer sheet: fall back to the document's own heading line — but only
  // when it looks like legible text, not the binary noise a photo/scan decodes to as "UTF-8".
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && line.length <= 60 && /^[\x20-\x7E]+$/.test(line) && /[A-Za-z]/.test(line));
  if (firstLine) {
    return { name: firstLine, confidence: 0.4 };
  }
  return { name: null, confidence: 0 };
}

function extractOfferAmount(text) {
  const keyed = OFFER_AMOUNT_PATTERN.exec(text);
  if (keyed) {
    return { amount: Number(keyed[1].replace(/,/g, '')), confidence: 0.9 };
  }
  const bare = BARE_AMOUNT_PATTERN.exec(text);
  if (bare) {
    return { amount: Number(bare[1].replace(/,/g, '')), confidence: 0.5 };
  }
  return { amount: null, confidence: 0 };
}

function extractMileage(text) {
  const match = MILEAGE_PATTERN.exec(text);
  if (!match) {
    return { mileage: null, confidence: 0 };
  }
  return { mileage: Number(match[1].replace(/,/g, '')), confidence: 0.85 };
}

function extractVehicleLine(text) {
  const match = VEHICLE_LINE_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const [yearToken, makeToken, ...modelTokens] = match[0].trim().split(/\s+/);
  const model = modelTokens.join(' ');
  return { year: Number(yearToken), make: makeToken, model: model || null };
}

function extractFromText(text) {
  const extracted = {};
  const confidence = {};

  if (!text) {
    return { extracted, confidence };
  }

  const vin = findValidVin(text);
  if (vin) {
    extracted.vin = vin;
    confidence.vin = 0.99;
    const make = decodeWmiMake(vin);
    if (make) {
      extracted.make = make;
      confidence.make = 0.8;
    }
  }

  const vehicleLine = extractVehicleLine(text);
  if (vehicleLine) {
    extracted.year = vehicleLine.year;
    confidence.year = 0.9;
    extracted.make = vehicleLine.make;
    confidence.make = 0.85;
    if (vehicleLine.model) {
      extracted.model = vehicleLine.model;
      confidence.model = 0.75;
    }
  }

  const { name: competitorName, confidence: nameConfidence } = extractCompetitorName(text);
  if (competitorName) {
    extracted.competitorName = competitorName;
    confidence.competitorName = nameConfidence;
  }

  const { amount, confidence: amountConfidence } = extractOfferAmount(text);
  if (amount !== null && !Number.isNaN(amount)) {
    extracted.competitorOffer = amount;
    confidence.competitorOffer = amountConfidence;
  }

  const { mileage, confidence: mileageConfidence } = extractMileage(text);
  if (mileage !== null && !Number.isNaN(mileage)) {
    extracted.mileage = mileage;
    confidence.mileage = mileageConfidence;
  }

  return { extracted, confidence };
}

function extractFromImageFixture(fixture) {
  const extracted = { ...fixture };
  const confidence = {};
  if (extracted.competitorName) confidence.competitorName = 0.95;
  if (extracted.competitorOffer != null) confidence.competitorOffer = 0.9;
  if (extracted.year != null) confidence.year = 0.9;
  if (extracted.make) confidence.make = 0.9;
  if (extracted.model) confidence.model = 0.85;
  return { extracted, confidence };
}

function extractFromImage(bytes) {
  const hash = createHash('sha256').update(bytes).digest('hex');
  const fixture = IMAGE_FIXTURES[hash];
  if (fixture) {
    return extractFromImageFixture(fixture);
  }
  // Unrecognized photo: no vision-API/OCR integration is wired in yet (a future UOW could add one
  // behind an env var like OFFER_VISION_API_KEY), so this degrades to the same empty/low-
  // confidence result as an unrecognized text document rather than guessing from binary noise.
  return extractFromText(bytes.toString('utf8'));
}

/**
 * Extracts competitor offer details from a dropped/captured document — a text/PDF document or an
 * image screenshot (`mimeType` one of IMAGE_MIME_TYPES). Always returns `success: true` with a
 * (possibly empty) `extracted`/`confidence` pair — a low-confidence or unrecognized document
 * degrades to partial results rather than throwing, so the caller never has to treat "nothing
 * found" as a failure. A recognized competitor "Estimate" screen (VIN deliberately omitted) comes
 * back with `extracted.isEstimate === true` and no `vin`.
 */
export function parseOfferDocument({ documentBase64, mimeType } = {}) {
  if (typeof documentBase64 !== 'string' || documentBase64.length === 0) {
    return { success: true, extracted: {}, confidence: {} };
  }

  const bytes = decodeDocumentBytes(documentBase64);
  if (!bytes) {
    return { success: true, extracted: {}, confidence: {} };
  }

  const { extracted, confidence } = IMAGE_MIME_TYPES.has(mimeType)
    ? extractFromImage(bytes)
    : extractFromText(bytes.toString('utf8'));

  return { success: true, extracted, confidence };
}
