import { geocodeAddress, GooglePlacesGeocoder } from '@nemzilla/spatial-core';
import { haversineDistanceMiles } from '../utils/geo.js';

/**
 * Offline ZIP/city gazetteer: the fallback used when spatial-core's Google Places geocoder has no
 * API key configured, fails, or finds no match, and to caption a GPS fix (Places Text Search is
 * forward-geocoding only — reverse lookup stays a local nearest-known-point heuristic).
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

/** Reads a Google Places API key from explicit options, then the environment, then a browser global — never throws. */
function resolveApiKey(options = {}) {
  if (typeof options.apiKey === 'string' && options.apiKey) return options.apiKey;
  if (typeof process !== 'undefined' && process.env?.GOOGLE_PLACES_API_KEY) return process.env.GOOGLE_PLACES_API_KEY;
  if (typeof window !== 'undefined' && window.CARBOYZ_GOOGLE_PLACES_API_KEY) return window.CARBOYZ_GOOGLE_PLACES_API_KEY;
  return null;
}

function resolveOffline(text) {
  const query = normalize(text);
  if (!query) return null;

  const match = /^\d{5}$/.test(query) ? matchByZip(query) : matchByCity(query);
  return match ? { lat: match.lat, lng: match.lng, label: match.label } : null;
}

/**
 * Resolves free-form address/ZIP/city input to a point via spatial-core's Google Places geocoder,
 * falling back to the offline gazetteer whenever no API key is configured, the request fails, or
 * Google finds no match. Never throws.
 */
export async function resolveLocationQuery(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) return null;

  const geocoder = new GooglePlacesGeocoder({ apiKey: resolveApiKey(options), fetchImpl: options.fetchImpl });
  const googlePlace = await geocodeAddress(text, geocoder).catch(() => null);
  if (googlePlace) {
    return {
      lat: googlePlace.lat,
      lng: googlePlace.lng,
      label: googlePlace.displayName ?? googlePlace.formattedAddress ?? text.trim(),
    };
  }

  return resolveOffline(text);
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
