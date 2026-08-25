/** No-op resolver useful as a default/fallback when no geocoding backend is configured. */
export class NullGeocoder {
    async resolve(_address) {
        return null;
    }
}
/** Resolve an address using the given resolver (defaults to a no-op resolver). */
export async function geocodeAddress(address, resolver = new NullGeocoder()) {
    if (!address.trim())
        return null;
    return resolver.resolve(address);
}
const PLACES_SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const DEFAULT_GEOCODER_FIELD_MASK = "places.location,places.displayName,places.formattedAddress,places.viewport";
/**
 * Google Places (New) Text Search resolver — accepts free-form queries (street addresses, ZIP codes,
 * "City, ST") and resolves the first match to a point plus display metadata and viewport bounding box.
 * Dependency-injectable `fetchImpl`/`apiKey`, matching this stack's existing pluggable-fallback pattern
 * (see GooglePlacesAdapter): with no `apiKey` configured, `resolve` returns `null` with no network call,
 * so callers can layer this atop a static/offline resolver without branching on key presence.
 */
export class GooglePlacesGeocoder {
    apiKey;
    fetchImpl;
    fieldMask;
    constructor({ apiKey, fetchImpl, fieldMask } = {}) {
        this.apiKey = apiKey;
        // A bare `fetch` reference throws "Illegal invocation" when called detached from `window`/
        // `globalThis` (the spec's branding check) — bind it so the default path works in a real browser.
        this.fetchImpl = fetchImpl ?? fetch.bind(globalThis);
        this.fieldMask = fieldMask ?? DEFAULT_GEOCODER_FIELD_MASK;
    }
    /** Resolves the first match only — see `resolveMany` for the full candidate list. */
    async resolve(address) {
        return (await this.resolveMany(address, 1))[0] ?? null;
    }
    /**
     * Resolves up to `limit` candidate matches (for autocomplete/suggestion UIs). Google's Text Search
     * response already returns multiple `places` in one call, so this needs no extra request beyond
     * what `resolve` already made — just maps more of the same response.
     */
    async resolveMany(address, limit = 5) {
        const query = address.trim();
        if (!query || !this.apiKey)
            return [];
        const response = await this.fetchImpl(PLACES_SEARCH_TEXT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": this.apiKey,
                "X-Goog-FieldMask": this.fieldMask,
            },
            body: JSON.stringify({ textQuery: query }),
        });
        if (!response.ok)
            return [];
        const data = await response.json().catch(() => null);
        const rawPlaces = Array.isArray(data?.places) ? data.places : [];
        const places = [];
        for (const place of rawPlaces.slice(0, limit)) {
            const lat = place?.location?.latitude;
            const lng = place?.location?.longitude;
            if (typeof lat !== "number" || typeof lng !== "number")
                continue;
            const viewport = place?.viewport;
            const boundingBox = typeof viewport?.low?.latitude === "number" &&
                typeof viewport?.low?.longitude === "number" &&
                typeof viewport?.high?.latitude === "number" &&
                typeof viewport?.high?.longitude === "number"
                ? {
                    south: viewport.low.latitude,
                    west: viewport.low.longitude,
                    north: viewport.high.latitude,
                    east: viewport.high.longitude,
                }
                : undefined;
            places.push({
                lat,
                lng,
                displayName: place?.displayName?.text ?? query,
                formattedAddress: place?.formattedAddress ?? place?.displayName?.text ?? query,
                boundingBox,
            });
        }
        return places;
    }
}
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
/**
 * OpenStreetMap (Nominatim) resolver — a zero-cost, no-API-key alternative to GooglePlacesGeocoder.
 * Accepts free-form queries (street addresses, ZIP codes, "City, ST") and resolves the first match.
 * Dependency-injectable `fetchImpl` (default bound to `globalThis`, per GooglePlacesGeocoder's
 * "Illegal invocation" note above), `baseUrl` (to target a self-hosted instance or Photon-compatible
 * endpoint), and an optional `userAgent` — Nominatim's usage policy asks for a custom User-Agent/Referer
 * identifying the calling app, capped at 1 req/sec with no bulk use; browsers forbid scripts from
 * setting the User-Agent header via fetch, so this is a no-op there and only takes effect for
 * server-side/Node call sites.
 *
 * Nominatim's response quirks this normalizes away: `lat`/`lon` are strings, not numbers, and
 * `boundingbox` is `[south, north, west, east]` (Google's viewport is `{north,south,east,west}`) — get
 * either wrong and you silently get NaN coordinates or a transposed bounding box.
 */
export class OpenStreetMapGeocoder {
    baseUrl;
    fetchImpl;
    userAgent;
    constructor({ baseUrl, fetchImpl, userAgent } = {}) {
        this.baseUrl = baseUrl ?? NOMINATIM_SEARCH_URL;
        this.fetchImpl = fetchImpl ?? fetch.bind(globalThis);
        this.userAgent = userAgent;
    }
    /** Resolves the first match only — see `resolveMany` for the full candidate list. */
    async resolve(address) {
        return (await this.resolveMany(address, 1))[0] ?? null;
    }
    /** Resolves up to `limit` candidate matches (for autocomplete/suggestion UIs) — Nominatim's `/search` already supports `limit` directly. */
    async resolveMany(address, limit = 5) {
        const query = address.trim();
        if (!query)
            return [];
        const url = new URL(this.baseUrl);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("q", query);
        url.searchParams.set("limit", String(limit));
        const headers = {};
        if (this.userAgent)
            headers["User-Agent"] = this.userAgent;
        const response = await this.fetchImpl(url.toString(), { headers });
        if (!response.ok)
            return [];
        const data = await response.json().catch(() => null);
        // Also cap client-side rather than trusting the server to honor `limit` — same defensive
        // posture as GooglePlacesGeocoder.resolveMany, which can't rely on a request-side limit at all.
        const rawPlaces = (Array.isArray(data) ? data : []).slice(0, limit);
        const places = [];
        for (const place of rawPlaces) {
            const lat = Number(place.lat);
            const lng = Number(place.lon);
            if (Number.isNaN(lat) || Number.isNaN(lng))
                continue;
            const bbox = place.boundingbox;
            const boundingBox = Array.isArray(bbox) && bbox.length === 4
                ? { south: Number(bbox[0]), north: Number(bbox[1]), west: Number(bbox[2]), east: Number(bbox[3]) }
                : undefined;
            places.push({
                lat,
                lng,
                displayName: place.name ?? place.display_name ?? query,
                formattedAddress: place.display_name ?? query,
                boundingBox,
            });
        }
        return places;
    }
}
