import { haversineDistanceMiles, toRadians, toDegrees, EARTH_RADIUS_MILES } from '../utils/geo.js';
import { resolveZipOffline } from '../adapters/locationAdapter.js';

// Acquisition Radar (UOW-52): pure, DOM-free GeoJSON builders consumed by RadarMapView.js —
// same adapter/builder split carboyzAdapter.js established for the dealer/vehicle map.

export const RADAR_RING_RADII_MILES = Object.freeze([10, 25, 50]);
const RING_SEGMENTS = 64;

// CARTO Dark Matter palette: translucent amber/gold fills and crisp gold strokes for the HQ anchor
// and range rings, plus the three lead-pin status colors from the UOW-52 spec.
export const RADAR_STYLE = Object.freeze({
  hqAnchor: { color: '#F5C451', strokeColor: '#D9A62B' },
  ring: { fillColor: 'rgba(245, 196, 81, 0.08)', strokeColor: 'rgba(245, 196, 81, 0.45)', labelColor: '#F5C451' },
  pin: Object.freeze({
    PENDING: Object.freeze({ color: '#FBBF24', pulse: true, label: 'Action needed' }),
    ACTIVE: Object.freeze({ color: '#2ECC71', pulse: false, label: 'Active in territory' }),
    CLOSED: Object.freeze({ color: '#8A8F98', pulse: false, label: 'Closed' }),
  }),
});

/** Great-circle destination point `distanceMiles` from `origin` along `bearingDeg` (0 = north). */
function destinationPoint(origin, bearingDeg, distanceMiles) {
  const angularDistance = distanceMiles / EARTH_RADIUS_MILES;
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(origin.lat);
  const lng1 = toRadians(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: toDegrees(lat2), lng: toDegrees(lng2) };
}

/** Dealership HQ center pin, as a GeoJSON Point Feature, from tenantConfig.dealershipCoordinates. */
export function buildHqAnchorFeature(tenantConfig) {
  const { lat, lng } = tenantConfig?.dealershipCoordinates ?? {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('buildHqAnchorFeature requires tenantConfig.dealershipCoordinates.{lat,lng}');
  }
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { kind: 'hq-anchor', label: tenantConfig?.name ? `${tenantConfig.name} HQ` : 'Dealership HQ' },
  };
}

/** One `radiusMiles`-wide GeoJSON circle Polygon Feature, approximated as a RING_SEGMENTS-gon. */
export function buildRangeRingFeature(center, radiusMiles) {
  const coordinates = [];
  for (let i = 0; i <= RING_SEGMENTS; i += 1) {
    const bearing = (360 / RING_SEGMENTS) * i;
    const point = destinationPoint(center, bearing, radiusMiles);
    coordinates.push([point.lng, point.lat]);
  }
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coordinates] },
    properties: { kind: 'range-ring', radiusMiles, label: `${radiusMiles} mi` },
  };
}

/** Concentric acquisition-radius rings (default 10/25/50 mi) centered on the dealership HQ. */
export function buildRangeRingFeatures(center, radii = RADAR_RING_RADII_MILES) {
  return radii.map((radiusMiles) => buildRangeRingFeature(center, radiusMiles));
}

/**
 * Resolves a lead's map coordinates: an explicit submission.lat/lng wins when present, otherwise
 * falls back to offline-gazetteer resolution of submission.zipCode. Returns null — never throws —
 * when neither source resolves, so the caller can route the lead to the Unlocated Queue.
 */
export function resolveSubmissionCoordinates(submission) {
  if (typeof submission?.lat === 'number' && typeof submission?.lng === 'number') {
    return { lat: submission.lat, lng: submission.lng };
  }
  if (submission?.zipCode) {
    const resolved = resolveZipOffline(submission.zipCode);
    if (resolved) {
      return { lat: resolved.lat, lng: resolved.lng };
    }
  }
  return null;
}

/**
 * Buckets a submission into one of the three radar pin statuses. status is checked first
 * (PENDING_APPROVAL / AUTO_COUNTER_SENT / REJECTED are the literal values this model uses); any
 * open status that hasn't reached PENDING_APPROVAL yet (NEW / IN_REVIEW / OFFER_BEATEN / DECLINED)
 * still needs desk attention, so it buckets as PENDING too. winLossStatus is the tiebreaker for the
 * ACCEPTED/WON/PASSED/LOST labels the spec names, which aren't literal `status` values here.
 */
export function classifyLeadPinStatus(submission) {
  if (submission.status === 'REJECTED') return 'CLOSED';
  if (['LOST', 'EXPIRED', 'DECLINED'].includes(submission.winLossStatus)) return 'CLOSED';
  if (submission.status === 'AUTO_COUNTER_SENT') return 'ACTIVE';
  if (['MANUAL_APPROVED', 'WON'].includes(submission.winLossStatus)) return 'ACTIVE';
  return 'PENDING';
}

/** Vehicle year/make/model, falling back to "Vehicle" when all three are unresolved. */
function describeVehicle(submission) {
  return [submission.year, submission.make, submission.model].filter(Boolean).join(' ') || 'Vehicle';
}

/**
 * Splits submissions into mapped radar targets (a GeoJSON FeatureCollection, status-pinned and
 * HQ-distance-tagged) and an unlocated collection (null/unresolvable zipCode and no explicit
 * lat/lng) for the Unlocated Leads dock.
 */
export function buildLeadOriginFeatureCollection(submissions = [], hqCoordinates) {
  const features = [];
  const unlocated = [];

  for (const submission of submissions) {
    const coordinates = resolveSubmissionCoordinates(submission);
    if (!coordinates) {
      unlocated.push(submission);
      continue;
    }

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] },
      properties: {
        kind: 'lead-origin',
        submissionId: submission.id,
        vehicle: describeVehicle(submission),
        competitor: submission.competitor,
        offerAmount: submission.competitorOfferAmount,
        finalCounterOffer: submission.finalCounterOffer,
        status: submission.status,
        pinStatus: classifyLeadPinStatus(submission),
        distanceFromHqMiles: hqCoordinates
          ? Math.round(haversineDistanceMiles(hqCoordinates, coordinates) * 10) / 10
          : null,
      },
    });
  }

  return {
    featureCollection: { type: 'FeatureCollection', features },
    unlocated,
  };
}
