import { haversineDistanceMiles } from '../utils/geo.js';

const MILEAGE_VALUE_WEIGHT = 0.05;

const SORTERS = {
  price_asc: (a, b) => a.vehicle.price - b.vehicle.price,
  mileage_asc: (a, b) => (a.vehicle.mileage ?? Infinity) - (b.vehicle.mileage ?? Infinity),
  distance_asc: (a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity),
  best_value: (a, b) => computeValueScore(a.vehicle) - computeValueScore(b.vehicle),
};

function computeValueScore(vehicle) {
  return vehicle.price + (vehicle.mileage ?? 0) * MILEAGE_VALUE_WEIGHT;
}

export class SearchService {
  constructor({ dealers = [] } = {}) {
    this.dealersById = new Map(dealers.map((dealer) => [dealer.dealerId, dealer]));
  }

  registerDealer(dealer) {
    this.dealersById.set(dealer.dealerId, dealer);
  }

  resolveVehicleLocation(vehicle) {
    if (typeof vehicle.lat === 'number' && typeof vehicle.lng === 'number') {
      return { lat: vehicle.lat, lng: vehicle.lng };
    }
    const dealer = this.dealersById.get(vehicle.dealerId);
    return dealer ? { lat: dealer.lat, lng: dealer.lng } : null;
  }

  resolveOrigin({ origin, originDealerId }) {
    if (origin) {
      return origin;
    }
    if (originDealerId) {
      const dealer = this.dealersById.get(originDealerId);
      if (!dealer) {
        throw new Error(`SearchService: unknown originDealerId "${originDealerId}"`);
      }
      return { lat: dealer.lat, lng: dealer.lng };
    }
    return null;
  }

  search(vehicles, criteria = {}) {
    const {
      tenantId,
      maxPrice,
      maxMileage,
      bodyStyle,
      make,
      model,
      year,
      radiusMiles,
      sortBy,
    } = criteria;

    const origin = this.resolveOrigin(criteria);

    if (radiusMiles !== undefined && !origin) {
      throw new Error('SearchService: radius filtering requires an origin or originDealerId');
    }
    if (sortBy === 'distance_asc' && !origin) {
      throw new Error('SearchService: distance_asc sort requires an origin or originDealerId');
    }

    let results = vehicles;

    if (tenantId !== undefined) {
      results = results.filter((vehicle) => vehicle.belongsToTenant(tenantId));
    }
    if (maxPrice !== undefined) {
      results = results.filter((vehicle) => vehicle.price <= maxPrice);
    }
    if (maxMileage !== undefined) {
      results = results.filter(
        (vehicle) => vehicle.mileage !== null && vehicle.mileage <= maxMileage,
      );
    }
    if (bodyStyle !== undefined) {
      results = results.filter((vehicle) => vehicle.bodyStyle === bodyStyle);
    }
    if (make !== undefined || model !== undefined || year !== undefined) {
      results = results.filter((vehicle) => vehicle.matches({ make, model, year }));
    }

    let entries = results.map((vehicle) => {
      const location = origin ? this.resolveVehicleLocation(vehicle) : null;
      const distanceMiles = origin && location ? haversineDistanceMiles(origin, location) : null;
      return { vehicle, distanceMiles };
    });

    if (radiusMiles !== undefined) {
      entries = entries.filter(
        (entry) => entry.distanceMiles !== null && entry.distanceMiles <= radiusMiles,
      );
    }

    const sorter = SORTERS[sortBy];
    if (sorter) {
      entries = [...entries].sort(sorter);
    }

    return entries;
  }
}
