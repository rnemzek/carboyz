import { VendorAdapter } from '../adapters/VendorAdapter.js';
import { haversineDistanceMiles } from '../utils/geo.js';

export const DiscoveryStage = Object.freeze({
  SCANNING: 'SCANNING',
  PARSING: 'PARSING',
  CALCULATING: 'CALCULATING',
  COMPLETE: 'COMPLETE',
});

const DEFAULT_RADIUS_MILES = 50;

function defaultDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveFeedDealerLocation(rawDealer = {}) {
  return {
    lat: Number(rawDealer.latitude ?? rawDealer.lat),
    lng: Number(rawDealer.longitude ?? rawDealer.lng),
  };
}

export class DiscoveryService {
  constructor({ telemetryService, vendorFeeds = [], delayFn = defaultDelay, stageDelayMs = 400 } = {}) {
    if (!telemetryService) {
      throw new Error('DiscoveryService requires a telemetryService');
    }
    this.telemetryService = telemetryService;
    this.vendorFeeds = vendorFeeds;
    this.delayFn = delayFn;
    this.stageDelayMs = stageDelayMs;
  }

  async scanRadius({ origin, radiusMiles = DEFAULT_RADIUS_MILES, tenantId, onProgress } = {}) {
    if (!origin) {
      throw new Error('DiscoveryService.scanRadius requires an origin');
    }
    if (!tenantId) {
      throw new Error('DiscoveryService.scanRadius requires a tenantId');
    }

    const emit = (stage, detail = {}) => onProgress?.({ stage, ...detail });
    const adapter = new VendorAdapter({ tenantId });

    emit(DiscoveryStage.SCANNING, {
      message: `Scanning a ${radiusMiles}-mile radius for local vendor lots...`,
    });
    await this.delayFn(this.stageDelayMs);

    const localFeeds = this.vendorFeeds.filter((feed) => {
      const location = resolveFeedDealerLocation(feed.dealer);
      return haversineDistanceMiles(origin, location) <= radiusMiles;
    });
    emit(DiscoveryStage.SCANNING, {
      message: `Found ${localFeeds.length} local lot(s).`,
      dealersFound: localFeeds.length,
    });

    emit(DiscoveryStage.PARSING, { message: 'Parsing vendor inventory feeds...' });
    await this.delayFn(this.stageDelayMs);

    const dealers = [];
    const vehicles = [];
    for (const feed of localFeeds) {
      dealers.push(adapter.normalizeDealer(feed.dealer));
      for (const rawVehicle of feed.vehicles ?? []) {
        vehicles.push(adapter.normalizeVehicle(rawVehicle));
      }
    }
    emit(DiscoveryStage.PARSING, {
      message: `Parsed ${vehicles.length} vehicle listing(s).`,
      vehiclesFound: vehicles.length,
    });

    emit(DiscoveryStage.CALCULATING, { message: 'Calculating market telemetry...' });
    await this.delayFn(this.stageDelayMs);

    const vehicleResults = vehicles.map((vehicle) => {
      const marketStats = this.telemetryService.getMarketStats(vehicles, {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
      });
      const marketPosition =
        marketStats.average === null
          ? null
          : this.telemetryService.evaluateMarketPosition(vehicle, marketStats);
      return { vehicle, marketPosition };
    });
    emit(DiscoveryStage.CALCULATING, { message: 'Telemetry calculated.' });

    const result = { dealers, vehicleResults };
    emit(DiscoveryStage.COMPLETE, { message: 'Discovery complete.', ...result });

    return result;
  }
}
