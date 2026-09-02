import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Submission } from '../src/models/Submission.js';

function baseData(overrides = {}) {
  return {
    id: 's1',
    timestamp: '2026-08-25T00:00:00.000Z',
    vin: '1HGCM82633A004352',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    mileage: 30000,
    zipCode: '28451',
    competitor: 'CarMax',
    competitorOfferAmount: 18000,
    ...overrides,
  };
}

test('Submission requires id, timestamp, vin, year, make, model, mileage, and zipCode', () => {
  assert.throws(() => new Submission(baseData({ id: undefined })), /id/);
  assert.throws(() => new Submission(baseData({ timestamp: undefined })), /timestamp/);
  assert.throws(() => new Submission(baseData({ vin: undefined })), /vin/);
  assert.throws(() => new Submission(baseData({ year: undefined })), /year/);
  assert.throws(() => new Submission(baseData({ make: undefined })), /make/);
  assert.throws(() => new Submission(baseData({ model: undefined })), /model/);
  assert.throws(() => new Submission(baseData({ mileage: undefined })), /mileage/);
  assert.throws(() => new Submission(baseData({ zipCode: undefined })), /zipCode/);
});

test('Submission rejects a competitor outside the allowed enum', () => {
  assert.throws(() => new Submission(baseData({ competitor: 'Vroom' })), /competitor/);
});

test('Submission requires competitorDealerName only when competitor is Other', () => {
  assert.throws(
    () => new Submission(baseData({ competitor: 'Other', competitorDealerName: undefined })),
    /competitorDealerName/,
  );

  const withOther = new Submission(
    baseData({ competitor: 'Other', competitorDealerName: 'Joe\'s Auto' }),
  );
  assert.equal(withOther.competitorDealerName, "Joe's Auto");

  const withoutOther = new Submission(baseData({ competitorDealerName: 'ignored' }));
  assert.equal(withoutOther.competitorDealerName, null);
});

test('Submission requires a non-negative numeric competitorOfferAmount', () => {
  assert.throws(() => new Submission(baseData({ competitorOfferAmount: -1 })), /competitorOfferAmount/);
  assert.throws(() => new Submission(baseData({ competitorOfferAmount: 'lots' })), /competitorOfferAmount/);
  assert.doesNotThrow(() => new Submission(baseData({ competitorOfferAmount: 0 })));
});

test('Submission defaults status to NEW and rejects invalid statuses', () => {
  const submission = new Submission(baseData());
  assert.equal(submission.status, 'NEW');

  assert.throws(() => new Submission(baseData({ status: 'ARCHIVED' })), /status/);
  assert.doesNotThrow(() => new Submission(baseData({ status: 'OFFER_BEATEN' })));
});

test('Submission accepts PENDING_APPROVAL and AUTO_COUNTER_SENT statuses', () => {
  assert.doesNotThrow(() => new Submission(baseData({ status: 'PENDING_APPROVAL' })));
  assert.doesNotThrow(() => new Submission(baseData({ status: 'AUTO_COUNTER_SENT' })));
});

test('Submission defaults trim and offerDocument to null when omitted', () => {
  const submission = new Submission(baseData());
  assert.equal(submission.trim, null);
  assert.equal(submission.offerDocument, null);

  const withExtras = new Submission(baseData({ trim: 'XLE', offerDocument: 'data:image/png;base64,abc' }));
  assert.equal(withExtras.trim, 'XLE');
  assert.equal(withExtras.offerDocument, 'data:image/png;base64,abc');
});

test('Submission defaults policyVersionId to null when omitted and rejects a non-string value', () => {
  const submission = new Submission(baseData());
  assert.equal(submission.policyVersionId, null);

  assert.throws(() => new Submission(baseData({ policyVersionId: 42 })), /policyVersionId/);

  const withVersion = new Submission(baseData({ policyVersionId: 'v1.1.0' }));
  assert.equal(withVersion.policyVersionId, 'v1.1.0');
});
