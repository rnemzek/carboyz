import { GooglePlacesGeocoder } from '@nemzilla/spatial-core';
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

/** Reads a Google Places API key from explicit options, then the environment, then a browser global — never throws. */
export function resolveGooglePlacesApiKey(options = {}) {
  if (typeof options.apiKey === 'string' && options.apiKey) return options.apiKey;
  if (typeof process !== 'undefined' && process.env?.GOOGLE_PLACES_API_KEY) return process.env.GOOGLE_PLACES_API_KEY;
  if (typeof window !== 'undefined' && window.CARBOYZ_GOOGLE_PLACES_API_KEY) return window.CARBOYZ_GOOGLE_PLACES_API_KEY;
  return null;
}

/**
 * Resolves free-form location input (ZIP, city, "City, ST", street address) to a point + label.
 * Tries the offline gazetteer first (fast, deterministic, no network); falls back to live Google
 * Places geocoding for anything the gazetteer doesn't recognize (e.g. "Pensacola, FL"). Returns
 * `null` (never throws) when nothing resolves — including when no API key is configured, matching
 * this stack's existing LLM/geocoder pluggable-fallback pattern.
 */
export async function geocodeLocationQuery(text, options = {}) {
  const offlineMatch = resolveLocationQuery(text);
  if (offlineMatch) return offlineMatch;

  if (typeof text !== 'string' || !text.trim()) return null;
  const apiKey = resolveGooglePlacesApiKey(options);
  const fetchImpl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null);
  if (!apiKey || !fetchImpl) return null;

  const geocoder = new GooglePlacesGeocoder({ apiKey, fetchImpl });
  let resolved;
  try {
    resolved = await geocoder.resolve(text.trim());
  } catch {
    return null;
  }
  if (!resolved) return null;

  return {
    lat: resolved.lat,
    lng: resolved.lng,
    label: resolved.displayName ?? resolved.formattedAddress ?? text.trim(),
    formattedAddress: resolved.formattedAddress,
    boundingBox: resolved.boundingBox,
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
