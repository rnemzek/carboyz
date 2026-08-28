import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VIN_LENGTH,
  SCAN_BARCODE_FORMATS,
  normalizeVinText,
  isValidVinFormat,
  computeVinCheckDigit,
  validateVin,
  extractVinCandidates,
  findValidVin,
  decodeModelYear,
  decodeWmiMake,
  isCameraSupported,
  isBarcodeDetectorSupported,
  captureVideoFrame,
  createVinScanner,
} from '../src/utils/vinScanner.js';

const VALID_VIN = '1HGCM82633A004352'; // 2003 Honda Accord — same fixture VIN used elsewhere in the suite.

function fakeTrack() {
  return { stopped: false, stop() { this.stopped = true; } };
}

function createFrameScheduler() {
  const queue = [];
  return {
    requestFrame: (cb) => {
      queue.push(cb);
      return queue.length;
    },
    cancelFrame: () => {},
    async flushOnce() {
      const cb = queue.shift();
      if (cb) await cb();
    },
    pending: () => queue.length,
  };
}

test('VIN_LENGTH and SCAN_BARCODE_FORMATS are the expected constants', () => {
  assert.equal(VIN_LENGTH, 17);
  assert.deepEqual(SCAN_BARCODE_FORMATS, ['code_39', 'code_128', 'data_matrix']);
});

test('normalizeVinText upper-cases and strips non-alphanumeric characters', () => {
  assert.equal(normalizeVinText(' 1hg-cm8263 3a004352 '), '1HGCM82633A004352');
  assert.equal(normalizeVinText(null), '');
  assert.equal(normalizeVinText(undefined), '');
});

test('isValidVinFormat enforces 17 chars from the VIN alphabet (no I, O, Q)', () => {
  assert.equal(isValidVinFormat(VALID_VIN), true);
  assert.equal(isValidVinFormat('1HGCM8263'), false); // too short
  assert.equal(isValidVinFormat(`${VALID_VIN}9`), false); // too long
  assert.equal(isValidVinFormat('1HGCM8263IA004352'), false); // contains I
  assert.equal(isValidVinFormat('1HGCM8263OA004352'), false); // contains O
  assert.equal(isValidVinFormat('1HGCM8263QA004352'), false); // contains Q
  assert.equal(isValidVinFormat(12345), false);
});

test('computeVinCheckDigit derives the ISO 3779 / NHTSA modulus-11 check character', () => {
  assert.equal(computeVinCheckDigit(VALID_VIN), '3');
  assert.equal(computeVinCheckDigit('not-a-vin'), null);
});

test('validateVin accepts a VIN whose check digit matches and rejects a tampered one', () => {
  assert.equal(validateVin(VALID_VIN), true);
  const tampered = `${VALID_VIN.slice(0, 8)}9${VALID_VIN.slice(9)}`;
  assert.equal(validateVin(tampered), false);
  assert.equal(validateVin('short'), false);
});

test('extractVinCandidates finds 17-char VIN-alphabet runs inside noisy barcode/OCR text', () => {
  assert.deepEqual(extractVinCandidates(`VIN: ${VALID_VIN}\nDOOR JAMB STICKER`), [VALID_VIN]);
  assert.deepEqual(extractVinCandidates('too short'), []);
});

test('findValidVin returns the first check-digit-valid candidate, or null', () => {
  assert.equal(findValidVin(`garbage ${VALID_VIN} trailing`), VALID_VIN);
  const tampered = `${VALID_VIN.slice(0, 8)}9${VALID_VIN.slice(9)}`;
  assert.equal(findValidVin(tampered), null);
  assert.equal(findValidVin(''), null);
});

test('decodeModelYear resolves the position-10 code to the current 30-year cycle', () => {
  const referenceDate = new Date('2026-08-27T00:00:00Z');
  const yearCoded = (code) => `1HGCM8263${code}A004352`;

  assert.equal(decodeModelYear(yearCoded('A'), referenceDate), 2010);
  assert.equal(decodeModelYear(yearCoded('Y'), referenceDate), 2000);
  assert.equal(decodeModelYear(yearCoded('1'), referenceDate), 2001);
  assert.equal(decodeModelYear(VALID_VIN, referenceDate), 2003); // position 10 is '3'
});

test('decodeModelYear returns null for an invalid VIN or an unused position-10 code', () => {
  assert.equal(decodeModelYear('short'), null);
  assert.equal(decodeModelYear('1HGCM8263UA004352'), null); // U is never a valid year code
});

test('decodeWmiMake resolves known WMI prefixes and degrades to null otherwise', () => {
  assert.equal(decodeWmiMake(VALID_VIN), 'Honda');
  assert.equal(decodeWmiMake('ZZZZZZZZZZZZZZZZZ'), null);
  assert.equal(decodeWmiMake('short'), null);
});

test('isCameraSupported / isBarcodeDetectorSupported reflect the given scope', () => {
  assert.equal(isCameraSupported({ mediaDevices: { getUserMedia: () => {} } }), true);
  assert.equal(isCameraSupported({ mediaDevices: {} }), false);
  assert.equal(isCameraSupported({}), false);
  assert.equal(isBarcodeDetectorSupported({ BarcodeDetector: function BarcodeDetector() {} }), true);
  assert.equal(isBarcodeDetectorSupported({}), false);
});

test('captureVideoFrame draws the current video frame at its native resolution', () => {
  const calls = [];
  const ctx = { drawImage: (...args) => calls.push(args) };
  const video = { videoWidth: 640, videoHeight: 480 };
  assert.equal(captureVideoFrame(video, ctx), true);
  assert.deepEqual(calls, [[video, 0, 0, 640, 480]]);
});

test('captureVideoFrame no-ops for missing elements or a zero-dimension frame', () => {
  assert.equal(captureVideoFrame(null, { drawImage() {} }), false);
  assert.equal(captureVideoFrame({}, null), false);
  assert.equal(captureVideoFrame({ videoWidth: 0, videoHeight: 0 }, { drawImage() {} }), false);
});

test('createVinScanner reports unsupported when getUserMedia is unavailable', async () => {
  const errors = [];
  const scanner = createVinScanner({ mediaDevices: {}, onError: (e) => errors.push(e) });
  const started = await scanner.start();
  assert.equal(started, false);
  assert.deepEqual(errors, [{ reason: 'unsupported' }]);
  assert.doesNotThrow(() => scanner.stop());
});

test('createVinScanner reports permission-denied when getUserMedia rejects', async () => {
  const denied = new Error('NotAllowedError');
  const errors = [];
  const scanner = createVinScanner({
    mediaDevices: { getUserMedia: async () => { throw denied; } },
    onError: (e) => errors.push(e),
  });
  const started = await scanner.start();
  assert.equal(started, false);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].reason, 'permission-denied');
  assert.equal(errors[0].error, denied);
});

test('createVinScanner starts the camera without scanning when BarcodeDetector is unsupported', async () => {
  const track = fakeTrack();
  const stream = { getTracks: () => [track] };
  const videoElement = { srcObject: null, play: async () => {} };
  const scheduler = createFrameScheduler();

  const scanner = createVinScanner({
    videoElement,
    mediaDevices: { getUserMedia: async () => stream },
    BarcodeDetectorClass: undefined,
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
  });

  const started = await scanner.start();
  assert.equal(started, true);
  assert.equal(scanner.isBarcodeActive(), false);
  assert.equal(videoElement.srcObject, stream);
  assert.equal(scheduler.pending(), 0);

  scanner.stop();
  assert.equal(track.stopped, true);
  assert.equal(videoElement.srcObject, null);
});

test('createVinScanner auto-fills and self-stops on a valid barcode detection', async () => {
  const track = fakeTrack();
  const stream = { getTracks: () => [track] };
  const videoElement = { srcObject: null, play: async () => {} };
  const scheduler = createFrameScheduler();
  const detected = [];

  class FakeBarcodeDetector {
    constructor(options) {
      FakeBarcodeDetector.instances.push(this);
      this.options = options;
    }
    async detect() {
      return [{ rawValue: 'not a vin' }, { rawValue: VALID_VIN }];
    }
  }
  FakeBarcodeDetector.instances = [];

  const scanner = createVinScanner({
    videoElement,
    mediaDevices: { getUserMedia: async () => stream },
    BarcodeDetectorClass: FakeBarcodeDetector,
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
    onDetected: (result) => detected.push(result),
  });

  const started = await scanner.start();
  assert.equal(started, true);
  assert.equal(scanner.isBarcodeActive(), true);
  assert.deepEqual(FakeBarcodeDetector.instances[0].options, { formats: SCAN_BARCODE_FORMATS });

  await scheduler.flushOnce();

  assert.deepEqual(detected, [{ vin: VALID_VIN, source: 'barcode' }]);
  assert.equal(track.stopped, true);
  assert.equal(videoElement.srcObject, null);
  assert.equal(scanner.isBarcodeActive(), false);
  assert.equal(scheduler.pending(), 0);
});

test('createVinScanner keeps scanning when no valid VIN is found yet', async () => {
  const stream = { getTracks: () => [fakeTrack()] };
  const scheduler = createFrameScheduler();
  const detected = [];

  class FakeBarcodeDetector {
    async detect() {
      return [{ rawValue: 'garbage' }];
    }
  }

  const scanner = createVinScanner({
    videoElement: { srcObject: null },
    mediaDevices: { getUserMedia: async () => stream },
    BarcodeDetectorClass: FakeBarcodeDetector,
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
    onDetected: (result) => detected.push(result),
  });

  await scanner.start();
  await scheduler.flushOnce();

  assert.deepEqual(detected, []);
  assert.equal(scanner.isBarcodeActive(), true);
  assert.equal(scheduler.pending(), 1); // re-queued itself for the next frame

  scanner.stop();
});

test('createVinScanner reports detect-failed and keeps scanning on detector errors', async () => {
  const stream = { getTracks: () => [fakeTrack()] };
  const scheduler = createFrameScheduler();
  const errors = [];
  const detectError = new Error('detector exploded');

  class FakeBarcodeDetector {
    async detect() {
      throw detectError;
    }
  }

  const scanner = createVinScanner({
    videoElement: {},
    mediaDevices: { getUserMedia: async () => stream },
    BarcodeDetectorClass: FakeBarcodeDetector,
    requestFrame: scheduler.requestFrame,
    cancelFrame: scheduler.cancelFrame,
    onError: (e) => errors.push(e),
  });

  await scanner.start();
  await scheduler.flushOnce();

  assert.equal(errors.length, 1);
  assert.deepEqual(errors[0], { reason: 'detect-failed', error: detectError });
  assert.equal(scheduler.pending(), 1);

  scanner.stop();
});
