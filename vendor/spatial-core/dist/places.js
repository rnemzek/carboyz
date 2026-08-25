const PLACES_SEARCH_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const DEFAULT_FIELD_MASK = "places.id,places.displayName,places.location";
/**
 * Google Places (New) `searchNearby` adapter — the spatial-hydration "Look Far" gap-fill source.
 * Uses a Field Mask to request only `id, displayName, location`, keeping responses minimal.
 * Dependency-injectable `fetchImpl`/`apiKey`, matching this stack's existing LLM/geocoder pluggable-fallback
 * pattern: with no `apiKey` configured, `fetchRaw` resolves to an empty result set with no network call.
 */
export class GooglePlacesAdapter {
    providerId = "google-places";
    topic;
    apiKey;
    fetchImpl;
    fieldMask;
    constructor({ apiKey, fetchImpl, fieldMask, topic } = {}) {
        this.apiKey = apiKey;
        // See geocoder.ts's GooglePlacesGeocoder for why this can't be a bare `fetch` reference.
        this.fetchImpl = fetchImpl ?? fetch.bind(globalThis);
        this.fieldMask = fieldMask ?? DEFAULT_FIELD_MASK;
        this.topic = topic ?? "auto";
    }
    async fetchRaw(query) {
        if (!this.apiKey)
            return { places: [] };
        const response = await this.fetchImpl(PLACES_SEARCH_NEARBY_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": this.apiKey,
                "X-Goog-FieldMask": this.fieldMask,
            },
            body: JSON.stringify({
                includedTypes: [query.includedType],
                locationRestriction: {
                    circle: {
                        center: { latitude: query.lat, longitude: query.lng },
                        radius: query.radiusMeters,
                    },
                },
            }),
        });
        if (!response.ok)
            return { places: [] };
        const data = await response.json().catch(() => null);
        if (!data || !Array.isArray(data.places))
            return { places: [] };
        return { places: data.places };
    }
    async normalize(rawData) {
        const features = [];
        for (const place of rawData.places ?? []) {
            const lat = place.location?.latitude;
            const lng = place.location?.longitude;
            if (!place.id || typeof lat !== "number" || typeof lng !== "number")
                continue;
            features.push({
                id: place.id,
                title: place.displayName?.text ?? "Unnamed location",
                topic: this.topic,
                coordinates: { lat, lng },
                metadata: { googlePlaceId: place.id, primaryType: place.primaryType ?? null },
            });
        }
        return features;
    }
}
/**
 * Runs a "Look Far" gap-fill discovery: queries `adapter` around `origin`, caches every newly-discovered
 * node into `index` (skipping ids already indexed), and returns just the newly-cached features so a
 * caller can fold them into a LayerConfig before handing off to the active domain overlay.
 */
export async function discoverNearby(origin, radiusKm, { adapter, index, includedType = "car_dealer" }) {
    const rawData = await adapter.fetchRaw({
        lat: origin.lat,
        lng: origin.lng,
        radiusMeters: radiusKm * 1000,
        includedType,
    });
    const features = await adapter.normalize(rawData);
    const newFeatures = [];
    for (const feature of features) {
        if (index.has(feature.id))
            continue;
        index.upsert(feature);
        newFeatures.push(feature);
    }
    return newFeatures;
}
