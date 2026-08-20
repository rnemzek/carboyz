import { haversineDistanceMiles } from '../utils/geo.js';

/**
 * Offline ZIP/city gazetteer used to resolve manual location search and to caption a GPS fix.
 * Shaped to match spatial-core's pluggable `GeocoderResolver` interface (`{ lat, lng }`), extended
 * with a display `label`. No network calls, so resolution stays deterministic for tests.
 */
const KNOWN_LOCATIONS = [
  { zip: '28451', city: 'leland', state: 'nc', label: 'Leland, NC', lat: 34.2388, lng: -78.0145 },
  { zip: '28401', city: 'wilmington', state: 'nc', label: 'Wilmington, NC', lat: 34.2257, lng: -77.9447 },
  { zip: '80202', city: 'denver', state: 'co', label: 'Denver, CO', lat: 39.74, lng: -104.99 },
  { zip: '80401', city: 'golden', state: 'co', label: 'Golden, CO', lat: 39.7555, lng: -105.2211 },
  { zip: '02110', city: 'boston', state: 'ma', label: 'Boston, MA', lat: 42.3601, lng: -71.0589 },
  { zip: '02150', city: 'chelsea', state: 'ma', label: 'Chelsea, MA', lat: 42.39, lng: -71.0334 },
  { zip: '92602', city: 'irvine', state: 'ca', label: 'Irvine, CA', lat: 33.6846, lng: -117.8265 },
];

function normalize(text) {
  return text.trim().toLowerCase();
}

function matchByZip(query) {
  return KNOWN_LOCATIONS.find((entry) => entry.zip === query) ?? null;
}

function matchByCity(query) {
  const cityOnly = query.split(',')[0].trim();
  return (
    KNOWN_LOCATIONS.find((entry) => entry.city === cityOnly || entry.label.toLowerCase() === query) ?? null
  );
}

/** Resolves free-form ZIP or "City, ST" input to a known point, or `null` if unrecognized. */
export function resolveLocationQuery(text) {
  if (typeof text !== 'string') return null;
  const query = normalize(text);
  if (!query) return null;

  const match = /^\d{5}$/.test(query) ? matchByZip(query) : matchByCity(query);
  if (!match) return null;

  return { lat: match.lat, lng: match.lng, label: match.label };
}

/** Captions a coordinate pair (e.g. a GPS fix) with the nearest known location's label. */
export function describeCoordinates(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return 'Current Location';
  let nearest = null;
  let nearestDistance = Infinity;
  for (const entry of KNOWN_LOCATIONS) {
    const distance = haversineDistanceMiles({ lat, lng }, { lat: entry.lat, lng: entry.lng });
    if (distance < nearestDistance) {
      nearest = entry;
      nearestDistance = distance;
    }
  }
  if (!nearest) return 'Current Location';
  return nearestDistance < 1 ? nearest.label : `Near ${nearest.label}`;
}
