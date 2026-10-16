import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVehicleFromVin } from '../src/services/nhtsaVinDecoder.js';

const VALID_VIN = '1HGCM82633A004352';

function fakeOkResponse(body) {
  return { ok: true, json: async () => body };
}

test('resolveVehicleFromVin falls back to manual entry for a malformed VIN without fetching', async () => {
  const calls = [];
  const result = await resolveVehicleFromVin('too-short', { fetchImpl: (...args) => { calls.push(args); throw new Error('should not fetch'); } });

  assert.equal(calls.length, 0);
  assert.equal(result.source, 'manual-fallback');
  assert.equal(result.reason, 'invalid-vin-length');
  assert.equal(result.year, null);
  assert.equal(result.make, null);
});

test('resolveVehicleFromVin normalizes lowercase/whitespace input before decoding', async () => {
  const fetchImpl = async (url) => {
    assert.ok(url.includes(VALID_VIN));
    return fakeOkResponse({ Results: [{ ModelYear: '2020', Make: 'Toyota', Model: 'Camry', Trim: 'LE' }] });
  };

  const result = await resolveVehicleFromVin(`  ${VALID_VIN.toLowerCase()}  `, { fetchImpl });

  assert.equal(result.vin, VALID_VIN);
  assert.equal(result.source, 'nhtsa');
  assert.equal(result.year, 2020);
  assert.equal(result.make, 'Toyota');
  assert.equal(result.model, 'Camry');
  assert.equal(result.trim, 'LE');
});

test('resolveVehicleFromVin treats "Not Applicable" / blank NHTSA fields as null', async () => {
  const fetchImpl = async () =>
    fakeOkResponse({ Results: [{ ModelYear: '2020', Make: 'Toyota', Model: 'Camry', Trim: 'Not Applicable' }] });

  const result = await resolveVehicleFromVin(VALID_VIN, { fetchImpl });

  assert.equal(result.trim, null);
});

test('resolveVehicleFromVin falls back to manual entry on a non-OK response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503 });

  const result = await resolveVehicleFromVin(VALID_VIN, { fetchImpl });

  assert.equal(result.source, 'manual-fallback');
  assert.equal(result.reason, 'nhtsa-status-503');
});

test('resolveVehicleFromVin falls back to manual entry on an empty result set', async () => {
  const fetchImpl = async () => fakeOkResponse({ Results: [] });

  const result = await resolveVehicleFromVin(VALID_VIN, { fetchImpl });

  assert.equal(result.source, 'manual-fallback');
  assert.equal(result.reason, 'nhtsa-empty-result');
});

test('resolveVehicleFromVin falls back to manual entry without throwing when fetch rejects (offline)', async () => {
  const fetchImpl = async () => {
    throw new Error('network down');
  };

  const result = await resolveVehicleFromVin(VALID_VIN, { fetchImpl });

  assert.equal(result.source, 'manual-fallback');
  assert.equal(result.reason, 'network down');
});

test('resolveVehicleFromVin falls back to manual entry for a non-string vin without fetching', async () => {
  const calls = [];
  const result = await resolveVehicleFromVin(undefined, { fetchImpl: (...args) => { calls.push(args); throw new Error('should not fetch'); } });

  assert.equal(calls.length, 0);
  assert.equal(result.source, 'manual-fallback');
  assert.equal(result.vin, '');
});

test('resolveVehicleFromVin treats a null NHTSA field the same as a blank one', async () => {
  const fetchImpl = async () => fakeOkResponse({ Results: [{ ModelYear: null, Make: 'Toyota', Model: null, Trim: null }] });

  const result = await resolveVehicleFromVin(VALID_VIN, { fetchImpl });

  assert.equal(result.year, null);
  assert.equal(result.model, null);
});

test('resolveVehicleFromVin falls back to a generic reason when the thrown error has no message', async () => {
  const fetchImpl = async () => {
    throw {};
  };

  const result = await resolveVehicleFromVin(VALID_VIN, { fetchImpl });

  assert.equal(result.source, 'manual-fallback');
  assert.equal(result.reason, 'nhtsa-decode-failed');
});

test('resolveVehicleFromVin falls back to manual entry on an abort/timeout', async () => {
  const fetchImpl = async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  };

  const result = await resolveVehicleFromVin(VALID_VIN, { fetchImpl });

  assert.equal(result.source, 'manual-fallback');
  assert.equal(result.reason, 'nhtsa-timeout');
});
