/**
 * Zero-dependency production VIN decoder for the seller intake flow — standalone from the dev
 * Test Bed's sandbox `resolveVehicleFromVin` (src/components/dev/TestBedDrawer.js), which pulls
 * `@nemzilla/test-core`, a package explicitly scoped as a developer test-bed toolkit and never
 * meant to ship in the customer-facing bundle. Calls NHTSA's free public vPIC endpoint directly
 * with a fetch timeout, and degrades to a manual-fallback shape (not a throw) on any failure so a
 * network drop, timeout, or unrecognized VIN never blocks a seller from submitting their offer.
 */

const NHTSA_DECODE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues';
const DEFAULT_TIMEOUT_MS = 5000;
const VIN_LENGTH = 17;

const MANUAL_FALLBACK_FIELDS = { year: null, make: null, model: null, trim: null };

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

async function fetchWithTimeout(url, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves { vin, year, make, model, trim, source: 'nhtsa' | 'manual-fallback', reason? } for a
 * seller-supplied VIN. Never throws — an invalid VIN, a non-OK response, an empty NHTSA result
 * set, a timeout, or a network error all fall back to null specs so the caller can keep the
 * seller moving toward submission rather than getting stuck.
 */
export async function resolveVehicleFromVin(vin, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const normalizedVin = typeof vin === 'string' ? vin.trim().toUpperCase() : '';

  if (normalizedVin.length !== VIN_LENGTH) {
    return { vin: normalizedVin, ...MANUAL_FALLBACK_FIELDS, source: 'manual-fallback', reason: 'invalid-vin-length' };
  }

  try {
    const url = `${NHTSA_DECODE_URL}/${encodeURIComponent(normalizedVin)}?format=json`;
    const response = await fetchWithTimeout(url, { fetchImpl, timeoutMs });
    if (!response.ok) {
      return {
        vin: normalizedVin,
        ...MANUAL_FALLBACK_FIELDS,
        source: 'manual-fallback',
        reason: `nhtsa-status-${response.status}`,
      };
    }

    const payload = await response.json();
    const result = payload?.Results?.[0];
    if (!result) {
      return { vin: normalizedVin, ...MANUAL_FALLBACK_FIELDS, source: 'manual-fallback', reason: 'nhtsa-empty-result' };
    }

    return {
      vin: normalizedVin,
      year: normalizeNumber(result.ModelYear),
      make: normalizeField(result.Make),
      model: normalizeField(result.Model),
      trim: normalizeField(result.Trim),
      source: 'nhtsa',
    };
  } catch (error) {
    return {
      vin: normalizedVin,
      ...MANUAL_FALLBACK_FIELDS,
      source: 'manual-fallback',
      reason: error?.name === 'AbortError' ? 'nhtsa-timeout' : (error?.message ?? 'nhtsa-decode-failed'),
    };
  }
}
