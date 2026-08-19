import { Dealer } from '../models/Dealer.js';
import { Vehicle } from '../models/Vehicle.js';

export class VendorAdapter {
  constructor({ tenantId } = {}) {
    if (!tenantId) {
      throw new Error('VendorAdapter requires a tenantId');
    }
    this.tenantId = tenantId;
  }

  normalizeDealer(rawDealer = {}) {
    return new Dealer({
      tenantId: this.tenantId,
      dealerId: String(rawDealer.dealer_id ?? rawDealer.id),
      name: rawDealer.dealer_name ?? rawDealer.name ?? '',
      lat: Number(rawDealer.latitude ?? rawDealer.lat),
      lng: Number(rawDealer.longitude ?? rawDealer.lng),
    });
  }

  normalizeVehicle(rawVehicle = {}) {
    return new Vehicle({
      tenantId: this.tenantId,
      vehicleId: String(rawVehicle.id ?? rawVehicle.vin),
      dealerId: String(rawVehicle.dealer_id ?? rawVehicle.dealerId),
      make: rawVehicle.make ?? '',
      model: rawVehicle.model ?? '',
      year: rawVehicle.year ?? null,
      price: Number(rawVehicle.asking_price ?? rawVehicle.price),
      mileage: rawVehicle.odometer ?? rawVehicle.mileage ?? null,
      bodyStyle: rawVehicle.body_type ?? rawVehicle.bodyStyle ?? null,
    });
  }

  normalizeFeed(feed = {}) {
    const dealers = (feed.dealers ?? []).map((rawDealer) => this.normalizeDealer(rawDealer));
    const vehicles = (feed.vehicles ?? []).map((rawVehicle) => this.normalizeVehicle(rawVehicle));
    return { dealers, vehicles };
  }
}
