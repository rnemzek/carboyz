import { latLngToCell, gridDisk } from "./h3.js";
const EARTH_RADIUS_KM = 6371.0088;
/** A +/-5% band around the local median counts as at-market rather than mispriced. */
const FAIR_MARKET_BAND_PCT = 5;
/** Average H3 hexagon edge length (km) at each candidate resolution, per the H3 spec's cell area table. */
const AVG_HEX_EDGE_KM = {
    1: 418.6760055,
    2: 158.2446558,
    3: 59.81085794,
    4: 22.6063794,
    5: 8.544408276,
    6: 3.229482772,
    7: 1.220629759,
    8: 0.461354684,
};
function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}
function haversineDistanceKm(a, b) {
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}
/** Coarsest H3 resolution whose average hex edge still fits several cells across `radiusKm`. */
function resolutionForRadiusKm(radiusKm) {
    const resolutions = Object.keys(AVG_HEX_EDGE_KM)
        .map(Number)
        .sort((a, b) => b - a);
    for (const resolution of resolutions) {
        if (radiusKm / AVG_HEX_EDGE_KM[resolution] >= 2)
            return resolution;
    }
    return 1;
}
/** All H3 cell ids within `radiusKm` of `lat`/`lng`, via a grid disk sized to cover that radius. */
export function getNearbyCells(lat, lng, radiusKm) {
    const resolution = resolutionForRadiusKm(radiusKm);
    const gridRadius = Math.max(1, Math.ceil(radiusKm / AVG_HEX_EDGE_KM[resolution]));
    const originCell = latLngToCell(lat, lng, resolution);
    return new Set(gridDisk(originCell, gridRadius));
}
function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
function formatCurrency(value) {
    return `$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}
function buildSummary(params) {
    const { verdict, priceDelta, radiusKm, compCount } = params;
    const compLabel = compCount === 1 ? "comparable unit" : "comparable units";
    if (verdict === "Fair Market") {
        return `Priced within the local ${radiusKm}km market range across ${compCount} ${compLabel}.`;
    }
    const direction = verdict === "Underpriced" ? "below" : "above";
    return `Priced ${formatCurrency(priceDelta)} ${direction} local ${radiusKm}km market median across ${compCount} ${compLabel}.`;
}
/**
 * Evaluates `target`'s price against nearby comparables in `pool` within `radiusKm`, using H3 grid
 * disk membership (confirmed against exact Haversine distance) to find the local comp cluster.
 */
export function evaluateMarketComps(target, pool, radiusKm = 25) {
    const nearbyCells = getNearbyCells(target.lat, target.lng, radiusKm);
    const resolution = resolutionForRadiusKm(radiusKm);
    const comps = pool.filter((candidate) => {
        if (candidate.id === target.id)
            return false;
        const candidateCell = latLngToCell(candidate.lat, candidate.lng, resolution);
        if (!nearbyCells.has(candidateCell))
            return false;
        return haversineDistanceKm(target, candidate) <= radiusKm;
    });
    if (comps.length === 0) {
        return {
            targetId: target.id,
            compCount: 0,
            medianPrice: target.price,
            priceDelta: 0,
            percentageDelta: 0,
            verdict: "Fair Market",
            summary: `No comparable listings found within ${radiusKm}km — insufficient market data to evaluate pricing.`,
        };
    }
    const medianPrice = median(comps.map((comp) => comp.price));
    const priceDelta = target.price - medianPrice;
    const percentageDelta = medianPrice === 0 ? 0 : (priceDelta / medianPrice) * 100;
    let verdict;
    if (percentageDelta <= -FAIR_MARKET_BAND_PCT) {
        verdict = "Underpriced";
    }
    else if (percentageDelta >= FAIR_MARKET_BAND_PCT) {
        verdict = "Overpriced";
    }
    else {
        verdict = "Fair Market";
    }
    return {
        targetId: target.id,
        compCount: comps.length,
        medianPrice,
        priceDelta,
        percentageDelta,
        verdict,
        summary: buildSummary({ verdict, priceDelta, radiusKm, compCount: comps.length }),
    };
}
