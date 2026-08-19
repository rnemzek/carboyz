import { Vehicle } from '../models/Vehicle.js';

export class IngestService {
  constructor({ telemetryService, tenantId, marketVehicles = [] } = {}) {
    if (!telemetryService) {
      throw new Error('IngestService requires a telemetryService');
    }
    if (!tenantId) {
      throw new Error('IngestService requires a tenantId');
    }

    this.telemetryService = telemetryService;
    this.tenantId = tenantId;
    this.inventory = [...marketVehicles];
    this.sequence = 0;
  }

  generateVehicleId() {
    this.sequence += 1;
    return `${this.tenantId}-veh-${this.sequence}`;
  }

  intake(vehicleData = {}) {
    const vehicle = new Vehicle({
      ...vehicleData,
      vehicleId: vehicleData.vehicleId ?? this.generateVehicleId(),
      tenantId: this.tenantId,
    });

    const marketStats = this.telemetryService.getMarketStats(this.inventory, {
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
    });

    const marketPosition =
      marketStats.average === null
        ? null
        : this.telemetryService.evaluateMarketPosition(vehicle, marketStats);

    this.inventory.push(vehicle);

    return { vehicle, marketStats, marketPosition };
  }

  getInventory() {
    return [...this.inventory];
  }
}
