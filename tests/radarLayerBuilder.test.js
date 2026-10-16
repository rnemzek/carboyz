import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHqAnchorFeature,
  buildRangeRingFeature,
  buildRangeRingFeatures,
  resolveSubmissionCoordinates,
  classifyLeadPinStatus,
  buildLeadOriginFeatureCollection,
  RADAR_RING_RADII_MILES,
} from '../src/services/radarLayerBuilder.js';
import { haversineDistanceMiles } from '../src/utils/geo.js';
import { createTenantConfig } from '../src/config/tenantConfig.js';

const HQ = { lat: 34.2388, lng: -78.0145 };

function leadSubmission(overrides = {}) {
  return {
    id: 'sub-1',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    zipCode: null,
    lat: null,
    lng: null,
    competitor: 'CarMax',
    competitorOfferAmount: 15000,
    finalCounterOffer: null,
    status: 'NEW',
    winLossStatus: 'PENDING',
    ...overrides,
  };
}

test('buildHqAnchorFeature plots a GeoJSON Point at tenantConfig.dealershipCoordinates in [lng, lat] order', () => {
  const tenantConfig = createTenantConfig({ name: 'CarBoyZ Motors' });
  const feature = buildHqAnchorFeature(tenantConfig);

  assert.equal(feature.type, 'Feature');
  assert.equal(feature.geometry.type, 'Point');
  assert.deepEqual(feature.geometry.coordinates, [HQ.lng, HQ.lat]);
  assert.equal(feature.properties.kind, 'hq-anchor');
  assert.equal(feature.properties.label, 'CarBoyZ Motors HQ');
});

test('buildHqAnchorFeature throws when dealershipCoordinates is missing or non-numeric', () => {
  assert.throws(() => buildHqAnchorFeature({}), /dealershipCoordinates/);
  assert.throws(() => buildHqAnchorFeature({ dealershipCoordinates: { lat: 'north', lng: -78 } }), /dealershipCoordinates/);
});

test('buildRangeRingFeature approximates a closed circle polygon at the requested radius', () => {
  const feature = buildRangeRingFeature(HQ, 25);

  assert.equal(feature.geometry.type, 'Polygon');
  assert.equal(feature.properties.radiusMiles, 25);
  const ring = feature.geometry.coordinates[0];
  assert.ok(ring.length > 10, 'expected many points approximating a circle');

  // Every vertex should sit ~25 miles from the HQ center (haversine distance, degrees -> miles).
  for (const [lng, lat] of ring) {
    const distance = haversineDistanceMiles(HQ, { lat, lng });
    assert.ok(Math.abs(distance - 25) < 0.5, `expected ~25mi, got ${distance}`);
  }

  // The ring should close on itself (first vertex === last vertex).
  assert.deepEqual(ring[0], ring[ring.length - 1]);
});

test('buildRangeRingFeatures builds one ring per radius, defaulting to 10/25/50 miles', () => {
  const features = buildRangeRingFeatures(HQ);
  assert.deepEqual(features.map((f) => f.properties.radiusMiles), [...RADAR_RING_RADII_MILES]);

  const custom = buildRangeRingFeatures(HQ, [5]);
  assert.equal(custom.length, 1);
  assert.equal(custom[0].properties.radiusMiles, 5);
});

test('resolveSubmissionCoordinates prefers an explicit lat/lng over zipCode resolution', () => {
  const coords = resolveSubmissionCoordinates(leadSubmission({ lat: 1, lng: 2, zipCode: '28451' }));
  assert.deepEqual(coords, { lat: 1, lng: 2 });
});

test('resolveSubmissionCoordinates falls back to offline-gazetteer zipCode resolution', () => {
  const coords = resolveSubmissionCoordinates(leadSubmission({ zipCode: '28451' }));
  assert.deepEqual(coords, { lat: 34.2388, lng: -78.0145 });
});

test('resolveSubmissionCoordinates returns null for an unresolvable zipCode and no explicit lat/lng', () => {
  assert.equal(resolveSubmissionCoordinates(leadSubmission({ zipCode: '00000' })), null);
  assert.equal(resolveSubmissionCoordinates(leadSubmission({ zipCode: null })), null);
});

test('classifyLeadPinStatus buckets PENDING_APPROVAL and other open statuses as PENDING', () => {
  assert.equal(classifyLeadPinStatus(leadSubmission({ status: 'PENDING_APPROVAL' })), 'PENDING');
  assert.equal(classifyLeadPinStatus(leadSubmission({ status: 'NEW' })), 'PENDING');
  assert.equal(classifyLeadPinStatus(leadSubmission({ status: 'IN_REVIEW' })), 'PENDING');
});

test('classifyLeadPinStatus buckets AUTO_COUNTER_SENT, and WON/MANUAL_APPROVED winLossStatus, as ACTIVE', () => {
  assert.equal(classifyLeadPinStatus(leadSubmission({ status: 'AUTO_COUNTER_SENT' })), 'ACTIVE');
  assert.equal(
    classifyLeadPinStatus(leadSubmission({ status: 'OFFER_BEATEN', winLossStatus: 'WON' })),
    'ACTIVE',
  );
  assert.equal(
    classifyLeadPinStatus(leadSubmission({ status: 'OFFER_BEATEN', winLossStatus: 'MANUAL_APPROVED' })),
    'ACTIVE',
  );
});

test('classifyLeadPinStatus buckets REJECTED, and LOST/EXPIRED/DECLINED winLossStatus, as CLOSED', () => {
  assert.equal(classifyLeadPinStatus(leadSubmission({ status: 'REJECTED' })), 'CLOSED');
  assert.equal(
    classifyLeadPinStatus(leadSubmission({ status: 'OFFER_BEATEN', winLossStatus: 'LOST' })),
    'CLOSED',
  );
  assert.equal(
    classifyLeadPinStatus(leadSubmission({ status: 'OFFER_BEATEN', winLossStatus: 'EXPIRED' })),
    'CLOSED',
  );
  assert.equal(
    classifyLeadPinStatus(leadSubmission({ status: 'OFFER_BEATEN', winLossStatus: 'DECLINED' })),
    'CLOSED',
  );
});

test('buildLeadOriginFeatureCollection splits submissions into mapped radar targets and an unlocated collection', () => {
  const mapped = leadSubmission({ id: 'mapped-1', zipCode: '28451', status: 'PENDING_APPROVAL' });
  const unresolvable = leadSubmission({ id: 'unlocated-1', zipCode: '00000' });
  const nullZip = leadSubmission({ id: 'unlocated-2', zipCode: null });

  const { featureCollection, unlocated } = buildLeadOriginFeatureCollection(
    [mapped, unresolvable, nullZip],
    HQ,
  );

  assert.equal(featureCollection.type, 'FeatureCollection');
  assert.equal(featureCollection.features.length, 1);
  assert.deepEqual(unlocated, [unresolvable, nullZip]);

  const [feature] = featureCollection.features;
  assert.deepEqual(feature.geometry.coordinates, [-78.0145, 34.2388]);
  assert.equal(feature.properties.submissionId, 'mapped-1');
  assert.equal(feature.properties.vehicle, '2020 Toyota Camry');
  assert.equal(feature.properties.pinStatus, 'PENDING');
  assert.ok(typeof feature.properties.distanceFromHqMiles === 'number');
});

test('buildLeadOriginFeatureCollection leaves distanceFromHqMiles null when no hqCoordinates is given', () => {
  const mapped = leadSubmission({ zipCode: '28451' });
  const { featureCollection } = buildLeadOriginFeatureCollection([mapped], undefined);
  assert.equal(featureCollection.features[0].properties.distanceFromHqMiles, null);
});

test('buildLeadOriginFeatureCollection defaults to an empty collection for no submissions', () => {
  const { featureCollection, unlocated } = buildLeadOriginFeatureCollection([], HQ);
  assert.deepEqual(featureCollection.features, []);
  assert.deepEqual(unlocated, []);
});
