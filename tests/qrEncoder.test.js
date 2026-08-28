import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQrMatrix, renderQrSvg, ALIGNMENT_POSITIONS } from '../src/utils/qrEncoder.js';

function expectedFinderCell(dr, dc) {
  return dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
}

function assertFinderPatternAt(matrix, baseRow, baseCol) {
  for (let dr = 0; dr <= 6; dr++) {
    for (let dc = 0; dc <= 6; dc++) {
      assert.equal(
        matrix[baseRow + dr][baseCol + dc],
        expectedFinderCell(dr, dc),
        `mismatch at finder-relative (${dr},${dc}) from base (${baseRow},${baseCol})`,
      );
    }
  }
}

test('encodeQrMatrix throws on empty input', () => {
  assert.throws(() => encodeQrMatrix(''), /non-empty/);
});

test('encodeQrMatrix rejects an unsupported error correction level', () => {
  assert.throws(() => encodeQrMatrix('hello', { errorCorrectionLevel: 'H' }), /'L' or 'M'/);
});

test('encodeQrMatrix is deterministic for the same input', () => {
  const a = encodeQrMatrix('https://example.com/sell?pf=abc', { errorCorrectionLevel: 'L' });
  const b = encodeQrMatrix('https://example.com/sell?pf=abc', { errorCorrectionLevel: 'L' });
  assert.deepEqual(a, b);
});

test('encodeQrMatrix produces a square matrix sized per version formula (4*version+17)', () => {
  const matrix = encodeQrMatrix('short payload', { errorCorrectionLevel: 'L' });
  const size = matrix.length;
  assert.equal((size - 17) % 4, 0);
  matrix.forEach((row) => assert.equal(row.length, size));
});

test('encodeQrMatrix places finder patterns at all three corners', () => {
  const matrix = encodeQrMatrix('finder pattern check', { errorCorrectionLevel: 'L' });
  const size = matrix.length;
  assertFinderPatternAt(matrix, 0, 0);
  assertFinderPatternAt(matrix, 0, size - 7);
  assertFinderPatternAt(matrix, size - 7, 0);
});

test('encodeQrMatrix bumps version when payload crosses the version-1 byte capacity boundary', () => {
  // Version 1, EC level L: 19 data codewords = 152 bits; byte-mode header is 4+8=12 bits,
  // leaving 140 bits (17.5 bytes) for data -> 17 ASCII bytes fits version 1 (21x21), 18 doesn't.
  const fits = encodeQrMatrix('a'.repeat(17), { errorCorrectionLevel: 'L' });
  const overflows = encodeQrMatrix('a'.repeat(18), { errorCorrectionLevel: 'L' });
  assert.equal(fits.length, 21);
  assert.equal(overflows.length, 25);
});

test('encodeQrMatrix exercises the version-info blocks (version >= 7) without crashing and stays deterministic', () => {
  // Version 6 L tops out at 134 bytes; 140 bytes forces version 7, which is the smallest version
  // that carries the 18-bit version-info blocks (reserveVersionInfoAreas/writeVersionInfo).
  const payload = 'a'.repeat(140);
  const matrix = encodeQrMatrix(payload, { errorCorrectionLevel: 'L' });
  assert.equal(matrix.length, 45); // 4*7+17
  assert.deepEqual(matrix, encodeQrMatrix(payload, { errorCorrectionLevel: 'L' }));
  assertFinderPatternAt(matrix, 0, 0);
  assertFinderPatternAt(matrix, 0, matrix.length - 7);
  assertFinderPatternAt(matrix, matrix.length - 7, 0);
});

test('encodeQrMatrix exercises the two-group block split (version 8, EC level M) without crashing', () => {
  // Version 7 M tops out at 122 bytes; 130 bytes forces version 8 at level M, whose block layout
  // has a non-empty second group (g2Blocks=2), exercising buildBlocks/interleaveBlocks' group-2 path.
  const payload = 'b'.repeat(130);
  const matrix = encodeQrMatrix(payload, { errorCorrectionLevel: 'M' });
  assert.equal(matrix.length, 49); // 4*8+17
  assert.deepEqual(matrix, encodeQrMatrix(payload, { errorCorrectionLevel: 'M' }));
});

test('encodeQrMatrix exercises the 16-bit character-count-indicator branch (version 10)', () => {
  // Version 9 L tops out at 230 bytes; byte mode switches from an 8-bit to a 16-bit character
  // count indicator at version 10, and version 10 L also has a non-empty second block group.
  const payload = 'c'.repeat(250);
  const matrix = encodeQrMatrix(payload, { errorCorrectionLevel: 'L' });
  assert.equal(matrix.length, 57); // 4*10+17
  assert.deepEqual(matrix, encodeQrMatrix(payload, { errorCorrectionLevel: 'L' }));
});

test('encodeQrMatrix throws when the payload exceeds version 10 capacity', () => {
  assert.throws(() => encodeQrMatrix('x'.repeat(400), { errorCorrectionLevel: 'M' }), /too large/);
});

test('encodeQrMatrix counts payload length in bytes, not JS string length, for multi-byte characters', () => {
  // 'č' is 2 bytes in UTF-8 but 1 UTF-16 code unit; 9 of them = 18 bytes, which overflows
  // version 1's 17-byte capacity at EC level L (see boundary test above) into version 2.
  const matrix = encodeQrMatrix('č'.repeat(9), { errorCorrectionLevel: 'L' });
  assert.equal(matrix.length, 25);
});

test('every supported version has an alignment-pattern table entry', () => {
  for (let version = 1; version <= 10; version++) {
    assert.ok(Array.isArray(ALIGNMENT_POSITIONS[version]));
  }
});

test('renderQrSvg renders a well-formed SVG matching matrix dimensions and dark-module count', () => {
  const matrix = [
    [true, false],
    [false, true],
  ];
  const svg = renderQrSvg(matrix, { cellSize: 1, margin: 1 });
  assert.match(svg, /^<svg /);
  assert.match(svg, /viewBox="0 0 4 4"/);
  assert.match(svg, /width="4" height="4"/);
  const darkRectCount = (svg.match(/fill="#000000"/g) ?? []).length;
  assert.equal(darkRectCount, 2);
});

test('renderQrSvg output scales with a real encoded matrix', () => {
  const matrix = encodeQrMatrix('svg sizing check', { errorCorrectionLevel: 'L' });
  const svg = renderQrSvg(matrix, { cellSize: 4, margin: 8 });
  const expectedDimension = matrix.length * 4 + 16;
  assert.match(svg, new RegExp(`viewBox="0 0 ${expectedDimension} ${expectedDimension}"`));
});
