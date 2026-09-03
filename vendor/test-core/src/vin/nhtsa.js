// Zero-dependency wrapper around NHTSA's free, public vPIC "decode VIN values" endpoint. Uses
// decodevinvalues (flat single-result JSON), not decodevin (nested array-of-rows format).
const NHTSA_DECODE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues';

function normalizeField(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === 'Not Applicable' ? null : trimmed;
}

function normalizeNumber(value) {
  const normalized = normalizeField(value);
  if (normalized === null) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Decodes a VIN via NHTSA's vPIC API, normalized to
 * { year, make, model, trim, bodyClass, engineCylinders, driveType }.
 * Throws on a non-OK response or an empty result set — callers decide the fallback behavior.
 */
export async function decodeVIN(vin, { fetchImpl = fetch } = {}) {
  if (typeof vin !== 'string' || vin.length !== 17) {
    throw new Error('decodeVIN requires a 17-character VIN string');
  }

  const url = `${NHTSA_DECODE_URL}/${encodeURIComponent(vin)}?format=json`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`NHTSA decode failed with status ${response.status}`);
  }

  const payload = await response.json();
  const result = payload?.Results?.[0];
  if (!result) {
    throw new Error('NHTSA decode returned no results');
  }

  return {
    year: normalizeNumber(result.ModelYear),
    make: normalizeField(result.Make),
    model: normalizeField(result.Model),
    trim: normalizeField(result.Trim),
    bodyClass: normalizeField(result.BodyClass),
    engineCylinders: normalizeNumber(result.EngineCylinders),
    driveType: normalizeField(result.DriveType),
  };
}
