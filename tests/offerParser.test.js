import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseOfferDocument } from '../src/server/offerParser.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fixtures', 'offers');

function readFixtureText(name) {
  return readFileSync(join(FIXTURES_DIR, name), 'utf8');
}

function toDataUrl(text) {
  return `data:text/plain;base64,${Buffer.from(text, 'utf8').toString('base64')}`;
}

test('parseOfferDocument extracts VIN, offer amount, mileage, and competitor name from a CarMax offer sheet', () => {
  const text = readFixtureText('carmax-offer.txt');
  const result = parseOfferDocument({ documentBase64: toDataUrl(text) });

  assert.equal(result.success, true);
  assert.equal(result.extracted.vin, 'WNTTM0A30LWAYAANF');
  assert.equal(result.extracted.competitorOffer, 15250);
  assert.equal(result.extracted.mileage, 32450);
  assert.equal(result.extracted.competitorName, 'CarMax');
  assert.ok(result.confidence.vin > 0.9);
});

test('parseOfferDocument extracts VIN, offer amount, and year/make/model from a Carvana offer sheet', () => {
  const text = readFixtureText('carvana-offer.txt');
  const result = parseOfferDocument({ documentBase64: toDataUrl(text) });

  assert.equal(result.extracted.vin, 'K3PM8UY64YZ51G1RR');
  assert.equal(result.extracted.competitorOffer, 27800);
  assert.equal(result.extracted.competitorName, 'Carvana');
  assert.equal(result.extracted.year, 2020);
  assert.equal(result.extracted.make, 'Ford');
  assert.equal(result.extracted.model, 'F-150');
});

test('parseOfferDocument extracts a generic dealership name and vehicle metadata from a Hendrick offer sheet', () => {
  const text = readFixtureText('hendrick-offer.txt');
  const result = parseOfferDocument({ documentBase64: toDataUrl(text) });

  assert.equal(result.extracted.vin, '536E424M9TUP7RR3T');
  assert.equal(result.extracted.competitorOffer, 22150);
  assert.equal(result.extracted.mileage, 21300);
  assert.equal(result.extracted.year, 2022);
  assert.equal(result.extracted.make, 'Honda');
  assert.equal(result.extracted.model, 'CR-V');
  assert.match(result.extracted.competitorName, /HENDRICK/i);
  assert.ok(result.confidence.competitorName < 0.5, 'a generic heading match should carry low confidence');
});

test('parseOfferDocument recognizes a KBB offer sheet by its brand keyword', () => {
  const text = readFixtureText('kbb-offer.txt');
  const result = parseOfferDocument({ documentBase64: toDataUrl(text) });

  assert.equal(result.extracted.vin, 'SD1P4R0B6Y0LTYE7Z');
  assert.equal(result.extracted.competitorOffer, 31900);
  assert.equal(result.extracted.competitorName, 'KBB');
});

test('parseOfferDocument returns partial results without throwing when no VIN or amount is present', () => {
  const result = parseOfferDocument({ documentBase64: toDataUrl('Just some unrelated text with no useful fields.') });

  assert.equal(result.success, true);
  assert.equal(result.extracted.vin, undefined);
  assert.equal(result.extracted.competitorOffer, undefined);
});

test('parseOfferDocument gracefully falls back for malformed/non-text base64 payloads', () => {
  assert.doesNotThrow(() => {
    const result = parseOfferDocument({ documentBase64: 'not-valid-base64-###' });
    assert.equal(result.success, true);
    assert.deepEqual(result.extracted, {});
  });
});

test('parseOfferDocument gracefully falls back for a missing or empty documentBase64', () => {
  assert.deepEqual(parseOfferDocument({}), { success: true, extracted: {}, confidence: {} });
  assert.deepEqual(parseOfferDocument({ documentBase64: '' }), { success: true, extracted: {}, confidence: {} });
  assert.deepEqual(parseOfferDocument(undefined), { success: true, extracted: {}, confidence: {} });
});

test('parseOfferDocument accepts raw base64 without a data: URL prefix', () => {
  const result = parseOfferDocument({ documentBase64: Buffer.from(readFixtureText('kbb-offer.txt'), 'utf8').toString('base64') });
  assert.equal(result.extracted.vin, 'SD1P4R0B6Y0LTYE7Z');
});
