export class Dealer {
  constructor({ tenantId, dealerId, name, lat, lng }) {
    if (!tenantId) {
      throw new Error('Dealer requires a tenantId');
    }
    if (!dealerId) {
      throw new Error('Dealer requires a dealerId');
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new Error('Dealer requires numeric lat/lng coordinates');
    }

    this.tenantId = tenantId;
    this.dealerId = dealerId;
    this.name = name ?? '';
    this.lat = lat;
    this.lng = lng;
  }

  belongsToTenant(tenantId) {
    return this.tenantId === tenantId;
  }
}
