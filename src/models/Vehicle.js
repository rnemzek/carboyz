export class Vehicle {
  constructor({
    tenantId,
    vehicleId,
    dealerId,
    make,
    model,
    year,
    price,
    mileage,
    bodyStyle,
    condition,
    lat,
    lng,
  }) {
    if (!tenantId) {
      throw new Error('Vehicle requires a tenantId');
    }
    if (!vehicleId) {
      throw new Error('Vehicle requires a vehicleId');
    }
    if (!dealerId) {
      throw new Error('Vehicle requires a dealerId');
    }
    if (typeof price !== 'number' || price < 0) {
      throw new Error('Vehicle requires a non-negative numeric price');
    }

    this.tenantId = tenantId;
    this.vehicleId = vehicleId;
    this.dealerId = dealerId;
    this.make = make ?? '';
    this.model = model ?? '';
    this.year = year ?? null;
    this.price = price;
    this.mileage = mileage ?? null;
    this.bodyStyle = bodyStyle ?? null;
    this.condition = condition ?? null;
    this.lat = lat ?? null;
    this.lng = lng ?? null;
  }

  belongsToTenant(tenantId) {
    return this.tenantId === tenantId;
  }

  matches({ make, model, year } = {}) {
    return (
      (make === undefined || this.make === make) &&
      (model === undefined || this.model === model) &&
      (year === undefined || this.year === year)
    );
  }
}
