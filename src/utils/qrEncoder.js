// Zero-dependency QR Code encoder (ISO/IEC 18004), byte mode only, versions 1-10, EC levels L/M.
// Galois-field tables and the Reed-Solomon/BCH polynomials used for error-correction and
// format/version info are derived algorithmically at load time rather than hardcoded per-version,
// so the only per-version constants below are the spec's own structural tables (block layout,
// alignment-pattern centers, remainder bits) — verified against the spec's independently-known
// total-codewords-per-version sequence (26, 44, 70, 100, 134, 172, 196, 242, 292, 346).

const EC_INFO = {
  1: { L: { eccPerBlock: 7, g1Blocks: 1, g1Data: 19, g2Blocks: 0, g2Data: 0 }, M: { eccPerBlock: 10, g1Blocks: 1, g1Data: 16, g2Blocks: 0, g2Data: 0 } },
  2: { L: { eccPerBlock: 10, g1Blocks: 1, g1Data: 34, g2Blocks: 0, g2Data: 0 }, M: { eccPerBlock: 16, g1Blocks: 1, g1Data: 28, g2Blocks: 0, g2Data: 0 } },
  3: { L: { eccPerBlock: 15, g1Blocks: 1, g1Data: 55, g2Blocks: 0, g2Data: 0 }, M: { eccPerBlock: 26, g1Blocks: 1, g1Data: 44, g2Blocks: 0, g2Data: 0 } },
  4: { L: { eccPerBlock: 20, g1Blocks: 1, g1Data: 80, g2Blocks: 0, g2Data: 0 }, M: { eccPerBlock: 18, g1Blocks: 2, g1Data: 32, g2Blocks: 0, g2Data: 0 } },
  5: { L: { eccPerBlock: 26, g1Blocks: 1, g1Data: 108, g2Blocks: 0, g2Data: 0 }, M: { eccPerBlock: 24, g1Blocks: 2, g1Data: 43, g2Blocks: 0, g2Data: 0 } },
  6: { L: { eccPerBlock: 18, g1Blocks: 2, g1Data: 68, g2Blocks: 0, g2Data: 0 }, M: { eccPerBlock: 16, g1Blocks: 4, g1Data: 27, g2Blocks: 0, g2Data: 0 } },
  7: { L: { eccPerBlock: 20, g1Blocks: 2, g1Data: 78, g2Blocks: 0, g2Data: 0 }, M: { eccPerBlock: 18, g1Blocks: 4, g1Data: 31, g2Blocks: 0, g2Data: 0 } },
  8: { L: { eccPerBlock: 24, g1Blocks: 2, g1Data: 97, g2Blocks: 0, g2Data: 0 }, M: { eccPerBlock: 22, g1Blocks: 2, g1Data: 38, g2Blocks: 2, g2Data: 39 } },
  9: { L: { eccPerBlock: 30, g1Blocks: 2, g1Data: 116, g2Blocks: 0, g2Data: 0 }, M: { eccPerBlock: 22, g1Blocks: 3, g1Data: 36, g2Blocks: 2, g2Data: 37 } },
  10: { L: { eccPerBlock: 18, g1Blocks: 2, g1Data: 68, g2Blocks: 2, g2Data: 69 }, M: { eccPerBlock: 26, g1Blocks: 4, g1Data: 43, g2Blocks: 1, g2Data: 44 } },
};

export const ALIGNMENT_POSITIONS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

const REMAINDER_BITS = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };

const MAX_VERSION = 10;

// --- GF(256) arithmetic (primitive polynomial 0x11D), used for Reed-Solomon ECC ---

const GF_EXP = new Array(512);
const GF_LOG = new Array(256);
(function buildGaloisTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function polyMultiply(a, b) {
  const result = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      result[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return result;
}

function rsGeneratorPoly(degree) {
  let generator = [1];
  for (let i = 0; i < degree; i++) {
    generator = polyMultiply(generator, [1, GF_EXP[i]]);
  }
  return generator;
}

function rsComputeRemainder(dataBytes, eccCount) {
  const generator = rsGeneratorPoly(eccCount);
  const remainder = new Array(eccCount).fill(0);
  for (const dataByte of dataBytes) {
    const factor = dataByte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let i = 0; i < eccCount; i++) {
        remainder[i] ^= gfMul(generator[i + 1], factor);
      }
    }
  }
  return remainder;
}

// --- Format/version info (binary BCH codes, GF(2) polynomial division) ---

const EC_LEVEL_BITS = { L: 0b01, M: 0b00 };
const FORMAT_GENERATOR = 0b10100110111; // degree-10, spec constant 0x537
const FORMAT_MASK = 0b101010000010010; // spec constant 0x5412
const VERSION_GENERATOR = 0b1111100100101; // degree-12, spec constant 0x1F25

function computeFormatBits(level, maskPattern) {
  const data = (EC_LEVEL_BITS[level] << 3) | maskPattern;
  let remainder = data << 10;
  for (let i = 14; i >= 10; i--) {
    if (remainder & (1 << i)) {
      remainder ^= FORMAT_GENERATOR << (i - 10);
    }
  }
  return ((data << 10) | remainder) ^ FORMAT_MASK;
}

function computeVersionBits(version) {
  let remainder = version << 12;
  for (let i = 17; i >= 12; i--) {
    if (remainder & (1 << i)) {
      remainder ^= VERSION_GENERATOR << (i - 12);
    }
  }
  return (version << 12) | remainder;
}

function getBit(value, index) {
  return ((value >> index) & 1) === 1;
}

// --- Bit-stream helpers ---

function pushBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i--) {
    bits.push((value >> i) & 1);
  }
}

// --- Data codeword construction ---

function buildDataCodewords(bytes, version, level) {
  const info = EC_INFO[version][level];
  const totalDataCodewords = info.g1Blocks * info.g1Data + info.g2Blocks * info.g2Data;
  const cciBits = version <= 9 ? 8 : 16;
  const capacityBits = totalDataCodewords * 8;

  const bits = [];
  pushBits(bits, 0b0100, 4); // byte-mode indicator
  pushBits(bits, bytes.length, cciBits);
  for (const byte of bytes) pushBits(bits, byte, 8);

  const terminatorLength = Math.max(0, Math.min(4, capacityBits - bits.length));
  for (let i = 0; i < terminatorLength; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    dataCodewords.push(byte);
  }

  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (dataCodewords.length < totalDataCodewords) {
    dataCodewords.push(padBytes[padIndex % 2]);
    padIndex++;
  }

  return dataCodewords;
}

function fitsCapacity(bytes, version, level) {
  const info = EC_INFO[version]?.[level];
  if (!info) return false;
  const totalDataCodewords = info.g1Blocks * info.g1Data + info.g2Blocks * info.g2Data;
  const cciBits = version <= 9 ? 8 : 16;
  const neededBits = 4 + cciBits + bytes.length * 8;
  return neededBits <= totalDataCodewords * 8;
}

function chooseVersion(bytes, level) {
  for (let version = 1; version <= MAX_VERSION; version++) {
    if (fitsCapacity(bytes, version, level)) return version;
  }
  return null;
}

function buildBlocks(dataCodewords, version, level) {
  const info = EC_INFO[version][level];
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < info.g1Blocks; i++) {
    const data = dataCodewords.slice(offset, offset + info.g1Data);
    offset += info.g1Data;
    blocks.push({ data, ecc: rsComputeRemainder(data, info.eccPerBlock) });
  }
  for (let i = 0; i < info.g2Blocks; i++) {
    const data = dataCodewords.slice(offset, offset + info.g2Data);
    offset += info.g2Data;
    blocks.push({ data, ecc: rsComputeRemainder(data, info.eccPerBlock) });
  }
  return blocks;
}

function interleaveBlocks(blocks) {
  const result = [];
  const maxDataLen = Math.max(...blocks.map((block) => block.data.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of blocks) {
      if (i < block.data.length) result.push(block.data[i]);
    }
  }
  const eccLen = blocks[0].ecc.length;
  for (let i = 0; i < eccLen; i++) {
    for (const block of blocks) {
      result.push(block.ecc[i]);
    }
  }
  return result;
}

// --- Matrix construction ---

function createMatrix(size, fill) {
  return Array.from({ length: size }, () => new Array(size).fill(fill));
}

function isDarkInFinder(dr, dc) {
  return dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
}

function drawFinderPattern(matrix, isFunction, size, baseRow, baseCol) {
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = baseRow + dr;
      const c = baseCol + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const dark = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && isDarkInFinder(dr, dc);
      isFunction[r][c] = true;
      matrix[r][c] = dark;
    }
  }
}

function drawTimingPatterns(matrix, isFunction, size) {
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) {
      isFunction[6][i] = true;
      matrix[6][i] = i % 2 === 0;
    }
    if (!isFunction[i][6]) {
      isFunction[i][6] = true;
      matrix[i][6] = i % 2 === 0;
    }
  }
}

function drawAlignmentPattern(matrix, isFunction, size, centerRow, centerCol) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const r = centerRow + dr;
      const c = centerCol + dc;
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      isFunction[r][c] = true;
      matrix[r][c] = dark;
    }
  }
}

function drawAlignmentPatterns(matrix, isFunction, size, version) {
  const positions = ALIGNMENT_POSITIONS[version];
  if (positions.length === 0) return;
  const min = positions[0];
  const max = positions[positions.length - 1];
  for (const row of positions) {
    for (const col of positions) {
      const overlapsFinder =
        (row === min && col === min) || (row === min && col === max) || (row === max && col === min);
      if (overlapsFinder) continue;
      drawAlignmentPattern(matrix, isFunction, size, row, col);
    }
  }
}

function reserveFormatInfoAreas(matrix, isFunction, size) {
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) {
      isFunction[8][i] = true;
      matrix[8][i] = false;
    }
    if (!isFunction[i][8]) {
      isFunction[i][8] = true;
      matrix[i][8] = false;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[size - 1 - i][8] = true;
    matrix[size - 1 - i][8] = false;
  }
  for (let i = 0; i < 7; i++) {
    isFunction[8][size - 1 - i] = true;
    matrix[8][size - 1 - i] = false;
  }
  isFunction[size - 8][8] = true;
  matrix[size - 8][8] = true; // the always-dark module
}

function reserveVersionInfoAreas(matrix, isFunction, size, version) {
  if (version < 7) return;
  for (let i = 0; i < 18; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    isFunction[size - 11 + col][row] = true;
    matrix[size - 11 + col][row] = false;
    isFunction[row][size - 11 + col] = true;
    matrix[row][size - 11 + col] = false;
  }
}

function writeVersionInfo(matrix, version, size) {
  if (version < 7) return;
  const bits = computeVersionBits(version);
  for (let i = 0; i < 18; i++) {
    const bit = getBit(bits, i);
    const row = Math.floor(i / 3);
    const col = i % 3;
    matrix[size - 11 + col][row] = bit;
    matrix[row][size - 11 + col] = bit;
  }
}

function writeFormatInfo(matrix, level, maskId, size) {
  const bits = computeFormatBits(level, maskId);
  for (let i = 0; i <= 5; i++) matrix[8][i] = getBit(bits, i);
  matrix[8][7] = getBit(bits, 6);
  matrix[8][8] = getBit(bits, 7);
  matrix[7][8] = getBit(bits, 8);
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = getBit(bits, i);
  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = getBit(bits, i);
  for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = getBit(bits, i);
}

function placeDataBits(matrix, isFunction, bits, size) {
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (isFunction[row][col]) continue;
        matrix[row][col] = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        bitIndex++;
      }
    }
  }
}

const MASK_FUNCS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(matrix, isFunction, maskId, size) {
  const maskFn = MASK_FUNCS[maskId];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFunction[r][c]) continue;
      if (maskFn(r, c)) matrix[r][c] = !matrix[r][c];
    }
  }
}

function runPenalty(line) {
  let penalty = 0;
  let runLength = 1;
  for (let i = 1; i < line.length; i++) {
    if (line[i] === line[i - 1]) {
      runLength++;
    } else {
      if (runLength >= 5) penalty += 3 + (runLength - 5);
      runLength = 1;
    }
  }
  if (runLength >= 5) penalty += 3 + (runLength - 5);
  return penalty;
}

function countPatternMatches(line, pattern) {
  let count = 0;
  for (let i = 0; i + pattern.length <= line.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (line[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) count++;
  }
  return count;
}

const FINDER_LIKE_TRAILING_LIGHT = [true, false, true, true, true, false, true, false, false, false, false];
const FINDER_LIKE_LEADING_LIGHT = [false, false, false, false, true, false, true, true, true, false, true];

function computePenalty(matrix, size) {
  let penalty = 0;

  for (let r = 0; r < size; r++) {
    const row = matrix[r];
    penalty += runPenalty(row);
    penalty += countPatternMatches(row, FINDER_LIKE_TRAILING_LIGHT) * 40;
    penalty += countPatternMatches(row, FINDER_LIKE_LEADING_LIGHT) * 40;
  }
  for (let c = 0; c < size; c++) {
    const col = matrix.map((row) => row[c]);
    penalty += runPenalty(col);
    penalty += countPatternMatches(col, FINDER_LIKE_TRAILING_LIGHT) * 40;
    penalty += countPatternMatches(col, FINDER_LIKE_LEADING_LIGHT) * 40;
  }

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (matrix[r][c + 1] === v && matrix[r + 1][c] === v && matrix[r + 1][c + 1] === v) {
        penalty += 3;
      }
    }
  }

  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) dark++;
    }
  }
  const percentDark = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(percentDark - 50) / 5) * 10;

  return penalty;
}

function buildFunctionPatternSkeleton(version, size) {
  const matrix = createMatrix(size, false);
  const isFunction = createMatrix(size, false);

  drawFinderPattern(matrix, isFunction, size, 0, 0);
  drawFinderPattern(matrix, isFunction, size, 0, size - 7);
  drawFinderPattern(matrix, isFunction, size, size - 7, 0);
  drawTimingPatterns(matrix, isFunction, size);
  drawAlignmentPatterns(matrix, isFunction, size, version);
  reserveFormatInfoAreas(matrix, isFunction, size);
  reserveVersionInfoAreas(matrix, isFunction, size, version);
  writeVersionInfo(matrix, version, size);

  return { matrix, isFunction };
}

/**
 * Encodes `text` (byte mode) into a QR Code module matrix. Returns a `boolean[][]`
 * (true = dark module) sized for the smallest version (1-10) that fits the payload at the
 * requested error correction level.
 */
export function encodeQrMatrix(text, { errorCorrectionLevel = 'L' } = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('encodeQrMatrix requires a non-empty string');
  }
  if (errorCorrectionLevel !== 'L' && errorCorrectionLevel !== 'M') {
    throw new Error(`encodeQrMatrix only supports error correction levels 'L' or 'M', got: ${errorCorrectionLevel}`);
  }

  const bytes = Array.from(new TextEncoder().encode(text));
  const version = chooseVersion(bytes, errorCorrectionLevel);
  if (!version) {
    throw new Error(
      `Payload too large for a QR code up to version ${MAX_VERSION} at error correction level ${errorCorrectionLevel} (${bytes.length} bytes)`,
    );
  }

  const dataCodewords = buildDataCodewords(bytes, version, errorCorrectionLevel);
  const blocks = buildBlocks(dataCodewords, version, errorCorrectionLevel);
  const finalCodewords = interleaveBlocks(blocks);

  const finalBits = [];
  for (const byte of finalCodewords) pushBits(finalBits, byte, 8);
  const remainderBits = REMAINDER_BITS[version];
  for (let i = 0; i < remainderBits; i++) finalBits.push(0);

  const size = version * 4 + 17;
  const skeleton = buildFunctionPatternSkeleton(version, size);
  placeDataBits(skeleton.matrix, skeleton.isFunction, finalBits, size);

  let best = null;
  for (let maskId = 0; maskId < 8; maskId++) {
    const candidate = skeleton.matrix.map((row) => row.slice());
    applyMask(candidate, skeleton.isFunction, maskId, size);
    writeFormatInfo(candidate, errorCorrectionLevel, maskId, size);
    const penalty = computePenalty(candidate, size);
    if (!best || penalty < best.penalty) {
      best = { matrix: candidate, penalty };
    }
  }

  return best.matrix;
}

// Standard high-contrast palette: dark modules on a light background, regardless of caller
// theme, so mobile camera scanners get reliable optical contrast.
const QR_DARK_MODULE_COLOR = '#000000';
const QR_LIGHT_BACKGROUND_COLOR = '#FFFFFF';

// ISO/IEC 18004 recommends a minimum 4-module quiet zone around the symbol so scanners can
// distinguish the finder patterns from surrounding content.
const QUIET_ZONE_MODULES = 4;

/**
 * Renders a QR module matrix (from `encodeQrMatrix`) as a standalone SVG markup string.
 * Pure string builder — no DOM access, safe to call in any environment.
 */
export function renderQrSvg(matrix, { cellSize = 6, margin = cellSize * QUIET_ZONE_MODULES } = {}) {
  const size = matrix.length;
  const quietZone = cellSize * QUIET_ZONE_MODULES;
  const effectiveMargin = Math.max(margin, quietZone);
  const dimension = size * cellSize + effectiveMargin * 2;
  const rects = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        rects.push(
          `<rect x="${effectiveMargin + c * cellSize}" y="${effectiveMargin + r * cellSize}" width="${cellSize}" height="${cellSize}" fill="${QR_DARK_MODULE_COLOR}"/>`,
        );
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" width="${dimension}" height="${dimension}" shape-rendering="crispEdges" role="img">` +
    `<rect x="0" y="0" width="${dimension}" height="${dimension}" fill="${QR_LIGHT_BACKGROUND_COLOR}"/>` +
    `${rects.join('')}</svg>`
  );
}
