import { haversineDistanceMiles } from '../utils/geo.js';

export const MarketPosition = Object.freeze({
  UNDERPRICED: 'UNDERPRICED',
  FAIR: 'FAIR',
  OVERPRICED: 'OVERPRICED',
});

const POSITION_Z_THRESHOLD = 0.5;

export class TelemetryService {
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

  filterByRadius(vehicles, targetDealer, maxRadiusMiles) {
    const origin = { lat: targetDealer.lat, lng: targetDealer.lng };

    return vehicles
      .filter((vehicle) => vehicle.belongsToTenant(targetDealer.tenantId))
      .filter((vehicle) => {
        const location = this.resolveVehicleLocation(vehicle);
        if (!location) {
          return false;
        }
        return haversineDistanceMiles(origin, location) <= maxRadiusMiles;
      });
  }

  getMarketStats(vehicles, { make, model, year } = {}) {
    const prices = vehicles
      .filter((vehicle) => vehicle.matches({ make, model, year }))
      .map((vehicle) => vehicle.price)
      .sort((a, b) => a - b);

    const count = prices.length;
    if (count === 0) {
      return {
        count: 0,
        average: null,
        min: null,
        max: null,
        median: null,
        priceSpread: null,
        standardDeviation: null,
      };
    }

    const sum = prices.reduce((total, price) => total + price, 0);
    const average = sum / count;
    const min = prices[0];
    const max = prices[count - 1];
    const mid = Math.floor(count / 2);
    const median = count % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
    const priceSpread = max - min;
    const variance =
      prices.reduce((total, price) => total + (price - average) ** 2, 0) / count;
    const standardDeviation = Math.sqrt(variance);

    return { count, average, min, max, median, priceSpread, standardDeviation };
  }

  evaluateMarketPosition(vehicle, marketStats) {
    const { average, standardDeviation } = marketStats;
    if (average === null || average === undefined) {
      throw new Error('Cannot evaluate market position without market statistics');
    }

    if (!standardDeviation) {
      if (vehicle.price === average) {
        return MarketPosition.FAIR;
      }
      return vehicle.price < average ? MarketPosition.UNDERPRICED : MarketPosition.OVERPRICED;
    }

    const zScore = (vehicle.price - average) / standardDeviation;
    if (zScore <= -POSITION_Z_THRESHOLD) {
      return MarketPosition.UNDERPRICED;
    }
    if (zScore >= POSITION_Z_THRESHOLD) {
      return MarketPosition.OVERPRICED;
    }
    return MarketPosition.FAIR;
  }
}
