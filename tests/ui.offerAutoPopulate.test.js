import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestOfferParse, mapExtractedOfferToFormValues } from '../src/ui/offerAutoPopulate.js';

function fakeFetch(responseBody, { ok = true } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok, json: async () => responseBody };
  };
  return { fetchImpl, calls };
}

test('requestOfferParse posts the document to the parse endpoint and returns the parsed result', async () => {
  const { fetchImpl, calls } = fakeFetch({ success: true, extracted: { vin: '1HGCM82633A004352' }, confidence: { vin: 0.99 } });

  const result = await requestOfferParse({ documentBase64: 'data:text/plain;base64,abc', mimeType: 'text/plain', fetchImpl });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/offers/parse');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { documentBase64: 'data:text/plain;base64,abc', mimeType: 'text/plain' });
  assert.equal(result.success, true);
  assert.equal(result.extracted.vin, '1HGCM82633A004352');
});

test('requestOfferParse supports a custom endpoint override', async () => {
  const { fetchImpl, calls } = fakeFetch({ success: true, extracted: {}, confidence: {} });

  await requestOfferParse({ documentBase64: 'data:x', endpoint: '/custom/endpoint', fetchImpl });

  assert.equal(calls[0].url, '/custom/endpoint');
});

test('requestOfferParse returns a no-op result without throwing when documentBase64 is missing', async () => {
  const result = await requestOfferParse({});
  assert.deepEqual(result, { success: false, extracted: {}, confidence: {} });
});

test('requestOfferParse returns a no-op result when the response is not ok', async () => {
  const { fetchImpl } = fakeFetch({ success: true, extracted: { vin: 'should-not-be-used' } }, { ok: false });

  const result = await requestOfferParse({ documentBase64: 'data:x', fetchImpl });

  assert.deepEqual(result, { success: false, extracted: {}, confidence: {} });
});

test('requestOfferParse returns a no-op result without throwing when fetch rejects', async () => {
  const fetchImpl = async () => {
    throw new Error('network down');
  };

  const result = await requestOfferParse({ documentBase64: 'data:x', fetchImpl });

  assert.deepEqual(result, { success: false, extracted: {}, confidence: {} });
});

test('requestOfferParse returns a no-op result without throwing when the response body is not JSON', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => {
      throw new Error('invalid json');
    },
  });

  const result = await requestOfferParse({ documentBase64: 'data:x', fetchImpl });

  assert.deepEqual(result, { success: false, extracted: {}, confidence: {} });
});

test('mapExtractedOfferToFormValues passes through vin/year/make/model/mileage/offer amount', () => {
  const values = mapExtractedOfferToFormValues({
    vin: '1HGCM82633A004352',
    year: 2020,
    make: 'Ford',
    model: 'F-150',
    mileage: 48120,
    competitorOffer: 27800,
    competitorName: 'Carvana',
  });

  assert.equal(values.vin, '1HGCM82633A004352');
  assert.equal(values.year, 2020);
  assert.equal(values.make, 'Ford');
  assert.equal(values.model, 'F-150');
  assert.equal(values.mileage, 48120);
  assert.equal(values.competitorOfferAmount, 27800);
  assert.equal(values.competitor, 'Carvana');
  assert.equal(values.competitorDealerName, null);
});

test('mapExtractedOfferToFormValues matches a known competitor name case-insensitively', () => {
  const values = mapExtractedOfferToFormValues({ competitorName: 'carmax' });
  assert.equal(values.competitor, 'CarMax');
  assert.equal(values.competitorDealerName, null);
});

test('mapExtractedOfferToFormValues falls back to competitorDealerName for an unrecognized name', () => {
  const values = mapExtractedOfferToFormValues({ competitorName: 'HENDRICK AUTOMOTIVE GROUP - APPRAISAL OFFER' });
  assert.equal(values.competitor, null);
  assert.equal(values.competitorDealerName, 'HENDRICK AUTOMOTIVE GROUP - APPRAISAL OFFER');
});

test('mapExtractedOfferToFormValues defaults every field to null (isEstimate to false) when extracted is empty', () => {
  const values = mapExtractedOfferToFormValues({});
  assert.deepEqual(values, {
    vin: null,
    year: null,
    make: null,
    model: null,
    mileage: null,
    competitorOfferAmount: null,
    competitor: null,
    competitorDealerName: null,
    isEstimate: false,
  });
});

test('mapExtractedOfferToFormValues passes through a VIN-less competitor estimate without clearing other fields', () => {
  const values = mapExtractedOfferToFormValues({
    competitorName: 'Carvana',
    competitorOffer: 13100,
    year: 2020,
    make: 'Jeep',
    model: 'Wrangler Unlimited',
    isEstimate: true,
  });

  assert.equal(values.vin, null);
  assert.equal(values.isEstimate, true);
  assert.equal(values.year, 2020);
  assert.equal(values.make, 'Jeep');
  assert.equal(values.model, 'Wrangler Unlimited');
  assert.equal(values.competitor, 'Carvana');
  assert.equal(values.competitorOfferAmount, 13100);
});

test('mapExtractedOfferToFormValues defaults safely when called with no argument', () => {
  assert.doesNotThrow(() => mapExtractedOfferToFormValues());
});
