// ISO 3779 VIN check-digit math. The transliteration table and position weights below are the
// spec's own fixed constants (not derived), and are what makes a VIN's 9th character self-verifying.

const VIN_CHARSET = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ'; // excludes I/O/Q, matching ISO 3779

const TRANSLITERATION = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const CHECK_DIGIT_POSITION = 8;

function charValue(char) {
  if (char >= '0' && char <= '9') {
    return Number(char);
  }
  const value = TRANSLITERATION[char];
  if (value === undefined) {
    throw new Error(`Invalid VIN character: ${char}`);
  }
  return value;
}

/** ISO 3779 check digit for a 17-char VIN (the character at position 9 is ignored). */
export function calculateCheckDigit(vin) {
  if (typeof vin !== 'string' || vin.length !== 17) {
    throw new Error('calculateCheckDigit requires a 17-character VIN string');
  }
  const upper = vin.toUpperCase();
  let sum = 0;
  for (let position = 0; position < 17; position++) {
    if (position === CHECK_DIGIT_POSITION) continue;
    sum += charValue(upper[position]) * POSITION_WEIGHTS[position];
  }
  const remainder = sum % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

/** True iff `vin` is 17 valid VIN characters and its position-9 check digit matches ISO 3779. */
export function isValidVin(vin) {
  if (typeof vin !== 'string' || vin.length !== 17) return false;
  const upper = vin.toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(upper)) return false;
  try {
    return calculateCheckDigit(upper) === upper[CHECK_DIGIT_POSITION];
  } catch {
    return false;
  }
}

// mulberry32: small, fast, deterministic PRNG — same seed always produces the same VIN.
function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a valid 17-character VIN with a correct ISO 3779 check digit at position 9.
 * Pass `seed` for a deterministic, reproducible VIN; omit it for a random one.
 */
export function generateVin({ seed } = {}) {
  const random = seed !== undefined ? mulberry32(seed) : Math.random;
  const chars = [];
  for (let position = 0; position < 17; position++) {
    if (position === CHECK_DIGIT_POSITION) {
      chars.push('0'); // placeholder, overwritten below once the checksum is known
      continue;
    }
    chars.push(VIN_CHARSET[Math.floor(random() * VIN_CHARSET.length)]);
  }
  chars[CHECK_DIGIT_POSITION] = calculateCheckDigit(chars.join(''));
  return chars.join('');
}
