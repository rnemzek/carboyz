import { GooglePlacesGeocoder } from '@nemzilla/spatial-core';
import { haversineDistanceMiles } from '../utils/geo.js';

/**
 * Offline ZIP/city gazetteer used as the fast/deterministic first pass for manual location search and
 * to caption a GPS fix. Anything it doesn't recognize (e.g. "Pensacola, FL", any street address) falls
 * through to a live `GeocoderResolver` (see `resolveLocationQuery`) instead of failing closed.
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

/** Reads a Google Places API key from an explicit option, then env, then a browser global — same
 *  pluggable-fallback shape chatFilterAdapter.js uses for its Anthropic key. */
export function resolveGooglePlacesApiKey(options = {}) {
  if (typeof options.apiKey === 'string' && options.apiKey) return options.apiKey;
  if (typeof process !== 'undefined' && process.env?.GOOGLE_PLACES_API_KEY) return process.env.GOOGLE_PLACES_API_KEY;
  if (typeof window !== 'undefined' && window.CARBOYZ_GOOGLE_PLACES_API_KEY) return window.CARBOYZ_GOOGLE_PLACES_API_KEY;
  return undefined;
}

/** Builds the live geocoder `resolveLocationQuery` falls back to. No-key short-circuits to a no-op
 *  resolver (via GooglePlacesGeocoder's own no-apiKey guard), so this is safe to construct unconditionally. */
export function createDynamicGeocoder(options = {}) {
  return new GooglePlacesGeocoder({ apiKey: resolveGooglePlacesApiKey(options), fetchImpl: options.fetchImpl });
}

/**
 * Resolves free-form ZIP, "City, ST", street address, or landmark input to a point + label.
 * Checks the offline gazetteer first (fast, deterministic, no network); anything unrecognized there
 * falls through to `geocoder` (a spatial-core `GeocoderResolver`, defaulting to a live
 * `GooglePlacesGeocoder`). Returns `null` if neither resolves the input.
 */
export async function resolveLocationQuery(text, { geocoder = createDynamicGeocoder() } = {}) {
  if (typeof text !== 'string') return null;
  const query = normalize(text);
  if (!query) return null;

  const staticMatch = /^\d{5}$/.test(query) ? matchByZip(query) : matchByCity(query);
  if (staticMatch) return { lat: staticMatch.lat, lng: staticMatch.lng, label: staticMatch.label };

  const geocoded = await geocoder.resolve(text.trim());
  if (!geocoded) return null;

  return {
    lat: geocoded.lat,
    lng: geocoded.lng,
    label: geocoded.displayName ?? geocoded.formattedAddress ?? text.trim(),
    formattedAddress: geocoded.formattedAddress ?? null,
    boundingBox: geocoded.boundingBox ?? null,
  };
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
