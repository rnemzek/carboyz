import { latLngToCell, DEFAULT_RESOLUTION } from "./h3.js";
import { getNearbyCells } from "./agent.js";
/**
 * H3-indexed cache of geocoded features, keyed by cell then feature id. Used to cache spatial-hydration
 * fallback results (e.g. Places API discoveries) so repeated nearby queries don't re-fetch or re-index
 * nodes already known to the engine.
 *
 * Also tracks per-cell hydration timestamps, independent of feature presence: a cell can be legitimately
 * hydrated with zero results, so "is this cell fresh" (skip re-fetching) is a distinct question from
 * "does this cell have any features." See markCellHydrated/isCellFresh.
 */
export class SpatialCellIndex {
    resolution;
    ttlMs;
    cells = new Map();
    featureIds = new Set();
    hydratedAt = new Map();
    constructor({ resolution = DEFAULT_RESOLUTION, ttlMs } = {}) {
        this.resolution = resolution;
        this.ttlMs = ttlMs;
    }
    /** Indexes a feature into its H3 cell. No-ops for features without coordinates. */
    upsert(feature) {
        if (!feature.coordinates)
            return;
        const cell = latLngToCell(feature.coordinates.lat, feature.coordinates.lng, this.resolution);
        if (!this.cells.has(cell))
            this.cells.set(cell, new Map());
        this.cells.get(cell).set(feature.id, feature);
        this.featureIds.add(feature.id);
    }
    /** Whether a feature with this id is already indexed. */
    has(id) {
        return this.featureIds.has(id);
    }
    /** All indexed features whose cell falls within `radiusKm` of `lat`/`lng`. */
    queryNearby(lat, lng, radiusKm) {
        const nearbyCells = getNearbyCells(lat, lng, radiusKm);
        const results = [];
        for (const cell of nearbyCells) {
            const bucket = this.cells.get(cell);
            if (!bucket)
                continue;
            results.push(...bucket.values());
        }
        return results;
    }
    /** Records the H3 cell containing `lat`/`lng` as hydrated at `at` (defaults to now). */
    markCellHydrated(lat, lng, at = Date.now()) {
        const cell = latLngToCell(lat, lng, this.resolution);
        this.hydratedAt.set(cell, at);
    }
    /**
     * Whether the H3 cell containing `lat`/`lng` was hydrated within `ttlMs`. Always false for a cell
     * that's never been marked hydrated. Always true (once hydrated) when no `ttlMs` was configured.
     */
    isCellFresh(lat, lng, now = Date.now()) {
        const cell = latLngToCell(lat, lng, this.resolution);
        const hydratedAt = this.hydratedAt.get(cell);
        if (hydratedAt === undefined)
            return false;
        if (this.ttlMs === undefined)
            return true;
        return now - hydratedAt < this.ttlMs;
    }
}
