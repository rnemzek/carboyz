import { findValidVin, decodeWmiMake } from '../utils/vinScanner.js';

/**
 * Heuristic offer-document extraction. No OCR/pdf-parsing library is wired in (same
 * zero-dependency-per-module precedent documented in vinScanner.js) — the uploaded file is
 * decoded as UTF-8 text and scanned with regexes. That means a real photo/scan of a paper offer
 * (as opposed to a text-based PDF or the mobile test-bed's text fixtures) will decode to mostly
 * binary noise and come back with an empty/low-confidence `extracted`, which is the intended
 * graceful-fallback path, not a bug.
 */

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

function decodeDocumentText(documentBase64) {
  const base64 = documentBase64.startsWith('data:') && documentBase64.includes(',')
    ? documentBase64.slice(documentBase64.indexOf(',') + 1)
    : documentBase64;
  try {
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch {
    return '';
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

/**
 * Extracts competitor offer details from a dropped/captured document. Always returns
 * `success: true` with a (possibly empty) `extracted`/`confidence` pair — a low-confidence or
 * unrecognized document degrades to partial results rather than throwing, so the caller never
 * has to treat "nothing found" as a failure.
 */
export function parseOfferDocument({ documentBase64 } = {}) {
  const extracted = {};
  const confidence = {};

  if (typeof documentBase64 !== 'string' || documentBase64.length === 0) {
    return { success: true, extracted, confidence };
  }

  const text = decodeDocumentText(documentBase64);
  if (!text) {
    return { success: true, extracted, confidence };
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

  return { success: true, extracted, confidence };
}
