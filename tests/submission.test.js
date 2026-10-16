import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Submission, REJECTION_REASONS } from '../src/models/Submission.js';

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

test('Submission requires id, timestamp, vin, and mileage', () => {
  assert.throws(() => new Submission(baseData({ id: undefined })), /id/);
  assert.throws(() => new Submission(baseData({ timestamp: undefined })), /timestamp/);
  assert.throws(() => new Submission(baseData({ vin: undefined })), /vin/);
  assert.throws(() => new Submission(baseData({ mileage: undefined })), /mileage/);
});

test('Submission requires a positive numeric mileage', () => {
  assert.throws(() => new Submission(baseData({ mileage: 0 })), /mileage/);
  assert.throws(() => new Submission(baseData({ mileage: -500 })), /mileage/);
  assert.throws(() => new Submission(baseData({ mileage: 'lots' })), /mileage/);
  assert.doesNotThrow(() => new Submission(baseData({ mileage: 1 })));
});

// UOW-51: year/make/model/zipCode are no longer collected via manual form entry (VIN decode and
// document-OCR parsing can both miss), so they're relaxed to optional/nullable, same as trim.
test('Submission allows year, make, model, and zipCode to be omitted and defaults them to null', () => {
  const submission = new Submission(
    baseData({ year: undefined, make: undefined, model: undefined, zipCode: undefined }),
  );
  assert.equal(submission.year, null);
  assert.equal(submission.make, null);
  assert.equal(submission.model, null);
  assert.equal(submission.zipCode, null);

  assert.throws(() => new Submission(baseData({ year: 'not-a-year' })), /year/);
  assert.throws(() => new Submission(baseData({ make: 42 })), /make/);
  assert.throws(() => new Submission(baseData({ model: 42 })), /model/);
  assert.throws(() => new Submission(baseData({ zipCode: 28451 })), /zipCode/);
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

test('Submission defaults offerSourceType to FIRM_OFFER and rejects a value outside the enum', () => {
  const submission = new Submission(baseData());
  assert.equal(submission.offerSourceType, 'FIRM_OFFER');

  assert.throws(() => new Submission(baseData({ offerSourceType: 'GUESS' })), /offerSourceType/);

  const estimate = new Submission(baseData({ offerSourceType: 'ESTIMATE' }));
  assert.equal(estimate.offerSourceType, 'ESTIMATE');
});

test('Submission allows a missing vin only when offerSourceType is ESTIMATE (UOW-47 no-VIN counters)', () => {
  const noVinEstimate = new Submission(baseData({ vin: undefined, offerSourceType: 'ESTIMATE' }));
  assert.equal(noVinEstimate.vin, null);

  assert.throws(() => new Submission(baseData({ vin: undefined, offerSourceType: 'FIRM_OFFER' })), /vin/);
  assert.throws(() => new Submission(baseData({ vin: '' })), /vin/);

  const verifiedEstimate = new Submission(
    baseData({ vin: '1HGCM82633A004352', offerSourceType: 'ESTIMATE' }),
  );
  assert.equal(verifiedEstimate.vin, '1HGCM82633A004352');
});

test('Submission accepts REJECTED status when given a valid rejectionReason', () => {
  const submission = new Submission(
    baseData({ status: 'REJECTED', rejectionReason: 'CUSTOMER_UNRESPONSIVE' }),
  );
  assert.equal(submission.status, 'REJECTED');
  assert.equal(submission.rejectionReason, 'CUSTOMER_UNRESPONSIVE');
});

test('Submission requires a rejectionReason when status is REJECTED', () => {
  assert.throws(() => new Submission(baseData({ status: 'REJECTED' })), /rejectionReason/);
});

test('Submission rejects a rejectionReason outside the allowed enum', () => {
  assert.throws(
    () => new Submission(baseData({ status: 'REJECTED', rejectionReason: 'BECAUSE_I_SAID_SO' })),
    /rejectionReason/,
  );
});

test('Submission exposes all five rejectionReason enum values with human-readable labels', () => {
  assert.deepEqual(Object.keys(REJECTION_REASONS), [
    'COMPETITOR_OVER_RETAIL',
    'TITLE_OR_CONDITION_ISSUE',
    'INVENTORY_SATURATION',
    'CUSTOMER_UNRESPONSIVE',
    'OTHER',
  ]);
});

test('Submission defaults rejectionReason and rejectionNotes to null and accepts optional rejectionNotes', () => {
  const submission = new Submission(baseData());
  assert.equal(submission.rejectionReason, null);
  assert.equal(submission.rejectionNotes, null);

  const rejected = new Submission(
    baseData({ status: 'REJECTED', rejectionReason: 'OTHER', rejectionNotes: 'Seller ghosted us.' }),
  );
  assert.equal(rejected.rejectionNotes, 'Seller ghosted us.');

  assert.throws(
    () => new Submission(baseData({ status: 'REJECTED', rejectionReason: 'OTHER', rejectionNotes: 42 })),
    /rejectionNotes/,
  );
});

test('Submission defaults isAutoApproved, priceTierBucket, and projectedMargin to null and validates their types', () => {
  const submission = new Submission(baseData());
  assert.equal(submission.isAutoApproved, null);
  assert.equal(submission.priceTierBucket, null);
  assert.equal(submission.projectedMargin, null);

  assert.throws(() => new Submission(baseData({ isAutoApproved: 'yes' })), /isAutoApproved/);
  assert.throws(() => new Submission(baseData({ priceTierBucket: 42 })), /priceTierBucket/);
  assert.throws(() => new Submission(baseData({ projectedMargin: 'lots' })), /projectedMargin/);

  const withFields = new Submission(
    baseData({ isAutoApproved: true, priceTierBucket: '10k-20k', projectedMargin: -150 }),
  );
  assert.equal(withFields.isAutoApproved, true);
  assert.equal(withFields.priceTierBucket, '10k-20k');
  assert.equal(withFields.projectedMargin, -150);
});

test('Submission defaults nagSentAt and digestSentAt to null, and queuedForMorningDigest to false', () => {
  const submission = new Submission(baseData());
  assert.equal(submission.nagSentAt, null);
  assert.equal(submission.digestSentAt, null);
  assert.equal(submission.queuedForMorningDigest, false);

  assert.throws(() => new Submission(baseData({ nagSentAt: 123 })), /nagSentAt/);
  assert.throws(() => new Submission(baseData({ digestSentAt: 123 })), /digestSentAt/);

  const withFields = new Submission(
    baseData({ nagSentAt: '2026-08-25T00:20:00.000Z', queuedForMorningDigest: true, digestSentAt: '2026-08-26T13:00:00.000Z' }),
  );
  assert.equal(withFields.nagSentAt, '2026-08-25T00:20:00.000Z');
  assert.equal(withFields.queuedForMorningDigest, true);
  assert.equal(withFields.digestSentAt, '2026-08-26T13:00:00.000Z');
});
