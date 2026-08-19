import { buildVehicleCardViewModel } from './vehicleCard.js';

export class DealerStudioController {
  constructor({ ingestService, telemetryService, hapticsService } = {}) {
    if (!ingestService) {
      throw new Error('DealerStudioController requires an ingestService');
    }
    if (!telemetryService) {
      throw new Error('DealerStudioController requires a telemetryService');
    }

    this.ingestService = ingestService;
    this.telemetryService = telemetryService;
    this.hapticsService = hapticsService ?? null;
  }

  submitIntake(vehicleData) {
    const result = this.ingestService.intake(vehicleData);
    this.hapticsService?.vibrate?.();

    return {
      ...result,
      cardViewModel: buildVehicleCardViewModel({
        vehicle: result.vehicle,
        marketPosition: result.marketPosition,
      }),
    };
  }

  notifyPriceChange() {
    this.hapticsService?.vibrate?.();
  }

  buildInventoryViewModels() {
    const inventory = this.ingestService.getInventory();

    return inventory.map((vehicle) => {
      const marketStats = this.telemetryService.getMarketStats(inventory, {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
      });
      const marketPosition =
        marketStats.average === null
          ? null
          : this.telemetryService.evaluateMarketPosition(vehicle, marketStats);

      return buildVehicleCardViewModel({ vehicle, marketPosition });
    });
  }
}
