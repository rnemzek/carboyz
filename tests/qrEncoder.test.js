import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
  // margin (1) is below the 4-module quiet zone floor for cellSize 1, so it's clamped to 4.
  const svg = renderQrSvg(matrix, { cellSize: 1, margin: 1 });
  assert.match(svg, /^<svg /);
  assert.match(svg, /viewBox="0 0 10 10"/);
  assert.match(svg, /width="10" height="10"/);
  const darkRectCount = (svg.match(/fill="#000000"/g) ?? []).length;
  assert.equal(darkRectCount, 2);
});

test('renderQrSvg output scales with a real encoded matrix', () => {
  const matrix = encodeQrMatrix('svg sizing check', { errorCorrectionLevel: 'L' });
  // margin (8) is below the 4-module quiet zone floor for cellSize 4 (16), so it's clamped up.
  const svg = renderQrSvg(matrix, { cellSize: 4, margin: 8 });
  const expectedDimension = matrix.length * 4 + 32;
  assert.match(svg, new RegExp(`viewBox="0 0 ${expectedDimension} ${expectedDimension}"`));
});

test('renderQrSvg defaults to a solid white background with a mandatory 4-module quiet zone', () => {
  const matrix = encodeQrMatrix('quiet zone check', { errorCorrectionLevel: 'L' });
  const svg = renderQrSvg(matrix, { cellSize: 5 });
  const expectedMargin = 5 * 4;
  const expectedDimension = matrix.length * 5 + expectedMargin * 2;
  assert.match(svg, new RegExp(`viewBox="0 0 ${expectedDimension} ${expectedDimension}"`));
  assert.match(svg, /<rect x="0" y="0" width="\d+" height="\d+" fill="#FFFFFF"\/>/);
  const firstDarkRect = svg.match(/<rect x="(\d+)" y="(\d+)"[^>]*fill="#000000"/);
  assert.ok(firstDarkRect, 'expected at least one dark module rect');
  assert.ok(Number(firstDarkRect[1]) >= expectedMargin, 'dark modules must not intrude on the quiet zone (x)');
  assert.ok(Number(firstDarkRect[2]) >= expectedMargin, 'dark modules must not intrude on the quiet zone (y)');
});

test('renderQrSvg enforces the quiet zone even when a smaller margin is requested', () => {
  const matrix = encodeQrMatrix('clamp check', { errorCorrectionLevel: 'L' });
  const svg = renderQrSvg(matrix, { cellSize: 3, margin: 1 });
  const expectedMargin = 3 * 4;
  const expectedDimension = matrix.length * 3 + expectedMargin * 2;
  assert.match(svg, new RegExp(`viewBox="0 0 ${expectedDimension} ${expectedDimension}"`));
});

test('renderQrSvg marks the root SVG for crisp, unblurred edge rendering', () => {
  const matrix = encodeQrMatrix('crisp edges check', { errorCorrectionLevel: 'L' });
  const svg = renderQrSvg(matrix);
  assert.match(svg, /^<svg[^>]*\sshape-rendering="crispEdges"/);
});

test('encodeQrMatrix defaults to error correction level L, the lowest-overhead/most-compact level', () => {
  const withDefault = encodeQrMatrix('https://app.example.com/sell?sessionId=pair-abc123');
  const withExplicitL = encodeQrMatrix('https://app.example.com/sell?sessionId=pair-abc123', {
    errorCorrectionLevel: 'L',
  });
  assert.deepEqual(withDefault, withExplicitL);
});

test('encodeQrMatrix at level L never chooses a larger version than level M for the same payload (compact matrix density)', () => {
  // A realistic mobile-pairing URL: origin + path + a generated pairingSessionId.
  const pairingUrl = 'https://dealer-portal.carboyz.app/sell?sessionId=pair-a1b2c3d4e5f6-1738372929292';
  const levelL = encodeQrMatrix(pairingUrl, { errorCorrectionLevel: 'L' });
  const levelM = encodeQrMatrix(pairingUrl, { errorCorrectionLevel: 'M' });
  assert.ok(
    levelL.length <= levelM.length,
    `expected level L matrix (${levelL.length}) to be no larger than level M (${levelM.length})`,
  );
  // A realistic pairing URL should stay well within the small/large-module low-version range.
  assert.ok(levelL.length <= 41, `expected a low-version (<=41 module) matrix, got ${levelL.length}`);
});

test('.pairing-card__qr is a centered, square, high-contrast card matching the container spec', () => {
  const cssPath = fileURLToPath(new URL('../src/ui/styles.css', import.meta.url));
  const css = readFileSync(cssPath, 'utf8');
  const ruleMatch = css.match(/\.pairing-card__qr\s*\{([^}]*)\}/);
  assert.ok(ruleMatch, 'expected a .pairing-card__qr rule in styles.css');
  const rule = ruleMatch[1];
  assert.match(rule, /max-width:\s*280px/);
  assert.match(rule, /aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(rule, /margin:\s*16px auto/);
  assert.match(rule, /padding:\s*16px/);
  assert.match(rule, /border-radius:\s*12px/);
  assert.match(rule, /background:\s*#FFFFFF/i);
});

test('.pairing-card__qr svg fills its square container without stretching or leaving excess whitespace', () => {
  const cssPath = fileURLToPath(new URL('../src/ui/styles.css', import.meta.url));
  const css = readFileSync(cssPath, 'utf8');
  const ruleMatch = css.match(/\.pairing-card__qr svg\s*\{([^}]*)\}/);
  assert.ok(ruleMatch, 'expected a .pairing-card__qr svg rule in styles.css');
  const rule = ruleMatch[1];
  assert.match(rule, /width:\s*100%/);
  assert.match(rule, /height:\s*100%/);
});
