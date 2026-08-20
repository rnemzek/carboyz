import { evaluateMarketComps } from '@nemzilla/spatial-core';

const DEFAULT_RADIUS_KM = 25;

function resolveLocation(vehicle, dealersById) {
  if (typeof vehicle.lat === 'number' && typeof vehicle.lng === 'number') {
    return { lat: vehicle.lat, lng: vehicle.lng };
  }
  const dealer = dealersById.get(vehicle.dealerId);
  return dealer ? { lat: dealer.lat, lng: dealer.lng } : null;
}

/** Converts carboyz vehicles into spatial-core CompTarget points, dropping any without resolvable coordinates. */
export function buildCompPool(vehicles, dealers) {
  const dealersById = new Map(dealers.map((dealer) => [dealer.dealerId, dealer]));

  return vehicles
    .map((vehicle) => {
      const location = resolveLocation(vehicle, dealersById);
      if (!location) return null;
      return {
        id: vehicle.vehicleId,
        price: vehicle.price,
        mileage: vehicle.mileage ?? undefined,
        year: vehicle.year ?? undefined,
        lat: location.lat,
        lng: location.lng,
      };
    })
    .filter(Boolean);
}

/**
 * Evaluates a vehicle's price against nearby market comps drawn from the current inventory pool.
 * Returns null if the vehicle (or its dealer) has no resolvable coordinates to evaluate from.
 */
export function evaluateVehicleMarketPosition(vehicle, { vehicles = [], dealers = [], radiusKm = DEFAULT_RADIUS_KM } = {}) {
  const pool = buildCompPool(vehicles, dealers);
  const target = pool.find((comp) => comp.id === vehicle.vehicleId);
  if (!target) return null;
  return evaluateMarketComps(target, pool, radiusKm);
}
