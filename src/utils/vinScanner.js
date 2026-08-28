/**
 * VIN barcode/text scanning: pure ISO 3779 check-digit math, WMI/model-year decoding, and a
 * fully dependency-injected camera+BarcodeDetector engine (same DI precedent as
 * TenantConfigService/appraisalPdfGenerator's document/URL injection).
 */

export const VIN_LENGTH = 17;
export const SCAN_BARCODE_FORMATS = ['code_39', 'code_128', 'data_matrix'];

const VIN_FORMAT_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const VIN_CANDIDATE_PATTERN = /[A-HJ-NPR-Z0-9]{17}/g;

// ISO 3779 / NHTSA transliteration table (I, O, Q are never valid VIN characters).
const TRANSLITERATION = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

// Position-10 model year code, 30-year repeating cycle starting at 1980.
const YEAR_CODE_ORDER = 'ABCDEFGHJKLMNPRSTVWXY123456789'.split('');

// Best-effort WMI (position 1-3) prefix -> make table. Not exhaustive (no zero-dependency VIN
// database exists to embed); unknown prefixes degrade gracefully to `null` for manual entry.
const WMI_MAKE_TABLE = {
  '1FA': 'Ford', '1FB': 'Ford', '1FC': 'Ford', '1FD': 'Ford', '1FM': 'Ford', '1FT': 'Ford',
  '3FA': 'Ford', '3FE': 'Ford',
  '1G1': 'Chevrolet', '1G6': 'Cadillac', '1GC': 'Chevrolet', '1GT': 'GMC', '1GY': 'Cadillac',
  '2G1': 'Chevrolet', '3G1': 'Chevrolet',
  '1HG': 'Honda', '2HG': 'Honda', '3HG': 'Honda', '19X': 'Honda',
  '1J4': 'Jeep', '1J8': 'Jeep', '1C4': 'Jeep', '1C6': 'Ram',
  '2C3': 'Dodge', '2C4': 'Dodge', '1B3': 'Dodge',
  '1N4': 'Nissan', '1N6': 'Nissan', '3N1': 'Nissan', '5N1': 'Nissan', 'JN1': 'Nissan', 'JN8': 'Nissan',
  '1VW': 'Volkswagen', '3VW': 'Volkswagen', 'WVW': 'Volkswagen', 'WV1': 'Volkswagen', 'WV2': 'Volkswagen',
  '4T1': 'Toyota', '4T3': 'Toyota', '5TD': 'Toyota', '5TF': 'Toyota', 'JT2': 'Toyota', 'JTD': 'Toyota', 'JTH': 'Lexus', 'JTJ': 'Lexus',
  '5YJ': 'Tesla', '7SA': 'Tesla',
  'JHM': 'Honda', 'JH4': 'Acura', '19U': 'Acura',
  'KL': 'Chevrolet', 'KNA': 'Kia', 'KND': 'Kia', 'KNM': 'Nissan', 'KM8': 'Hyundai', 'KMH': 'Hyundai',
  'SAJ': 'Jaguar', 'SAL': 'Land Rover',
  'VF1': 'Renault', 'VF3': 'Peugeot', 'VF7': 'Citroen',
  'WA1': 'Audi', 'WAU': 'Audi',
  'WBA': 'BMW', 'WBS': 'BMW', 'WBX': 'BMW', 'WBY': 'BMW',
  'WDB': 'Mercedes-Benz', 'WDC': 'Mercedes-Benz', 'WDD': 'Mercedes-Benz',
  'WMW': 'Mini', 'WP0': 'Porsche', 'WP1': 'Porsche',
  'YV1': 'Volvo', 'YV4': 'Volvo',
  '4S3': 'Subaru', '4S4': 'Subaru', 'JF1': 'Subaru', 'JF2': 'Subaru',
  'JM1': 'Mazda', 'JM3': 'Mazda', '4F2': 'Mazda',
};

export function normalizeVinText(text) {
  return String(text ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidVinFormat(vin) {
  return typeof vin === 'string' && VIN_FORMAT_PATTERN.test(vin);
}

function vinCharValue(char) {
  if (char >= '0' && char <= '9') return Number(char);
  return TRANSLITERATION[char] ?? null;
}

/** Returns the expected check character ('0'-'9' or 'X'), or null for a malformed VIN. */
export function computeVinCheckDigit(vin) {
  if (!isValidVinFormat(vin)) return null;
  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i += 1) {
    const value = vinCharValue(vin[i]);
    if (value === null) return null;
    sum += value * POSITION_WEIGHTS[i];
  }
  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

/** Full ISO 3779 / NHTSA position-weighted modulus-11 check-digit validation. */
export function validateVin(vin) {
  if (!isValidVinFormat(vin)) return false;
  const expected = computeVinCheckDigit(vin);
  return expected !== null && vin[8] === expected;
}

/**
 * Extracts every 17-character VIN-alphabet run from arbitrary (barcode/typed/pasted) text.
 * Normalization happens per whitespace-delimited token (not across the whole string) so that a
 * label like "VIN: 1HGCM82633A004352" doesn't get merged into one run and shift the match window.
 */
export function extractVinCandidates(text) {
  return String(text ?? '')
    .split(/\s+/)
    .flatMap((token) => normalizeVinText(token).match(VIN_CANDIDATE_PATTERN) ?? []);
}

/** First check-digit-valid VIN found in arbitrary text, or null. */
export function findValidVin(text) {
  return extractVinCandidates(text).find((candidate) => validateVin(candidate)) ?? null;
}

/**
 * Decodes the position-10 model year code. The code repeats every 30 years, so the cycle is
 * resolved to whichever candidate is current as of `referenceDate` (never assumes a model year
 * more than one year in the future).
 */
export function decodeModelYear(vin, referenceDate = new Date()) {
  if (!isValidVinFormat(vin)) return null;
  const index = YEAR_CODE_ORDER.indexOf(vin[9]);
  if (index === -1) return null;

  const referenceYear = referenceDate.getFullYear();
  let year = 1980 + index;
  while (year + 30 <= referenceYear + 1) {
    year += 30;
  }
  return year;
}

/** Best-effort WMI (position 1-3) manufacturer lookup. Returns null for an unrecognized prefix. */
export function decodeWmiMake(vin) {
  if (!isValidVinFormat(vin)) return null;
  return WMI_MAKE_TABLE[vin.slice(0, 3)] ?? WMI_MAKE_TABLE[vin.slice(0, 2)] ?? null;
}

export function isCameraSupported(scope = typeof navigator !== 'undefined' ? navigator : undefined) {
  return typeof scope?.mediaDevices?.getUserMedia === 'function';
}

export function isBarcodeDetectorSupported(scope = typeof globalThis !== 'undefined' ? globalThis : undefined) {
  return typeof scope?.BarcodeDetector === 'function';
}

/** Draws the current video frame onto a 2D canvas context (the "frame grabber" utility). */
export function captureVideoFrame(videoElement, canvasContext, { width, height } = {}) {
  if (!videoElement || !canvasContext) return false;
  const w = width ?? videoElement.videoWidth ?? 0;
  const h = height ?? videoElement.videoHeight ?? 0;
  if (!w || !h) return false;
  canvasContext.drawImage(videoElement, 0, 0, w, h);
  return true;
}

/**
 * Fully dependency-injected camera + BarcodeDetector engine (real APIs default in a browser,
 * fakes in tests) — no automatic image-to-text OCR is implemented here (that would require a
 * real OCR engine, conflicting with this codebase's zero-dependency-per-module precedent); the
 * "fallback text parser" for a sticker/registration VIN that can't be barcode-scanned is
 * `findValidVin`, applied by the UI to whatever the user types or pastes.
 */
export function createVinScanner({
  videoElement = null,
  mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
  BarcodeDetectorClass = typeof globalThis !== 'undefined' ? globalThis.BarcodeDetector : undefined,
  requestFrame = (cb) =>
    typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(cb) : setTimeout(cb, 200),
  cancelFrame = (id) =>
    typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame(id) : clearTimeout(id),
  onDetected = () => {},
  onError = () => {},
} = {}) {
  let stream = null;
  let frameId = null;
  let detector = null;
  let stopped = true;

  function stop() {
    stopped = true;
    if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
    detector = null;
  }

  async function scanLoop() {
    if (stopped || !detector || !videoElement) return;
    try {
      const barcodes = await detector.detect(videoElement);
      const hit = (barcodes ?? []).map((barcode) => findValidVin(barcode.rawValue ?? '')).find(Boolean);
      if (hit) {
        onDetected({ vin: hit, source: 'barcode' });
        stop();
        return;
      }
    } catch (error) {
      onError({ reason: 'detect-failed', error });
    }
    if (!stopped) {
      frameId = requestFrame(scanLoop);
    }
  }

  async function start() {
    if (!mediaDevices?.getUserMedia) {
      onError({ reason: 'unsupported' });
      return false;
    }

    try {
      stream = await mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (error) {
      onError({ reason: 'permission-denied', error });
      return false;
    }

    stopped = false;
    if (videoElement) {
      videoElement.srcObject = stream;
      videoElement.play?.()?.catch?.(() => {});
    }

    if (BarcodeDetectorClass) {
      detector = new BarcodeDetectorClass({ formats: SCAN_BARCODE_FORMATS });
      frameId = requestFrame(scanLoop);
    }

    return true;
  }

  return { start, stop, isBarcodeActive: () => detector !== null };
}
