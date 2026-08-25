export const COMPETITORS = ['CarMax', 'Carvana', 'KBB', 'GiveMeTheVin', 'Other'];
export const SUBMISSION_STATUSES = ['NEW', 'IN_REVIEW', 'OFFER_BEATEN', 'DECLINED'];

export class Submission {
  constructor({
    id,
    timestamp,
    vin,
    year,
    make,
    model,
    trim,
    mileage,
    zipCode,
    competitor,
    competitorDealerName,
    competitorOfferAmount,
    offerDocument,
    status = 'NEW',
  }) {
    if (!id) {
      throw new Error('Submission requires an id');
    }
    if (!timestamp) {
      throw new Error('Submission requires a timestamp');
    }
    if (!vin) {
      throw new Error('Submission requires a vin');
    }
    if (!year) {
      throw new Error('Submission requires a year');
    }
    if (!make) {
      throw new Error('Submission requires a make');
    }
    if (!model) {
      throw new Error('Submission requires a model');
    }
    if (!mileage) {
      throw new Error('Submission requires a mileage');
    }
    if (!zipCode) {
      throw new Error('Submission requires a zipCode');
    }
    if (!COMPETITORS.includes(competitor)) {
      throw new Error(`Submission competitor must be one of: ${COMPETITORS.join(', ')}`);
    }
    if (competitor === 'Other' && !competitorDealerName) {
      throw new Error('Submission requires a competitorDealerName when competitor is Other');
    }
    if (typeof competitorOfferAmount !== 'number' || competitorOfferAmount < 0) {
      throw new Error('Submission requires a non-negative numeric competitorOfferAmount');
    }
    if (!SUBMISSION_STATUSES.includes(status)) {
      throw new Error(`Submission status must be one of: ${SUBMISSION_STATUSES.join(', ')}`);
    }

    this.id = id;
    this.timestamp = timestamp;
    this.vin = vin;
    this.year = year;
    this.make = make;
    this.model = model;
    this.trim = trim ?? null;
    this.mileage = mileage;
    this.zipCode = zipCode;
    this.competitor = competitor;
    this.competitorDealerName = competitor === 'Other' ? competitorDealerName : null;
    this.competitorOfferAmount = competitorOfferAmount;
    this.offerDocument = offerDocument ?? null;
    this.status = status;
  }
}
