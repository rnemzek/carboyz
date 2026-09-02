export const COMPETITORS = ['CarMax', 'Carvana', 'KBB', 'GiveMeTheVin', 'Other'];
export const SUBMISSION_STATUSES = [
  'NEW',
  'IN_REVIEW',
  'OFFER_BEATEN',
  'DECLINED',
  'PENDING_APPROVAL',
  'AUTO_COUNTER_SENT',
];
export const WIN_LOSS_STATUSES = [
  'PENDING',
  'AUTO_COUNTERED',
  'MANUAL_APPROVED',
  'WON',
  'LOST',
  'EXPIRED',
  'DECLINED',
];
export const APPROVAL_TYPES = ['AUTO_DISPATCH', 'HUMAN_APPROVED'];

function validateOptionalNumber(value, fieldName, { allowNegative = false } = {}) {
  if (value === undefined || value === null) {
    return;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Submission ${fieldName} must be a number`);
  }
  if (!allowNegative && value < 0) {
    throw new Error(`Submission ${fieldName} must be a non-negative number`);
  }
}

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
    winLossStatus = 'PENDING',
    initialCompetitorOffer,
    calculatedCounterOffer,
    finalCounterOffer,
    expectedMargin,
    timeToCounterMs,
    priceBracket,
    approvalType,
    policyVersionId,
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
    if (!WIN_LOSS_STATUSES.includes(winLossStatus)) {
      throw new Error(`Submission winLossStatus must be one of: ${WIN_LOSS_STATUSES.join(', ')}`);
    }
    if (approvalType !== undefined && approvalType !== null && !APPROVAL_TYPES.includes(approvalType)) {
      throw new Error(`Submission approvalType must be one of: ${APPROVAL_TYPES.join(', ')}`);
    }
    validateOptionalNumber(initialCompetitorOffer, 'initialCompetitorOffer');
    validateOptionalNumber(calculatedCounterOffer, 'calculatedCounterOffer');
    validateOptionalNumber(finalCounterOffer, 'finalCounterOffer');
    validateOptionalNumber(expectedMargin, 'expectedMargin', { allowNegative: true });
    validateOptionalNumber(timeToCounterMs, 'timeToCounterMs');
    if (priceBracket !== undefined && priceBracket !== null && typeof priceBracket !== 'string') {
      throw new Error('Submission priceBracket must be a string');
    }
    if (policyVersionId !== undefined && policyVersionId !== null && typeof policyVersionId !== 'string') {
      throw new Error('Submission policyVersionId must be a string');
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
    this.winLossStatus = winLossStatus;
    this.initialCompetitorOffer = initialCompetitorOffer ?? null;
    this.calculatedCounterOffer = calculatedCounterOffer ?? null;
    this.finalCounterOffer = finalCounterOffer ?? null;
    this.expectedMargin = expectedMargin ?? null;
    this.timeToCounterMs = timeToCounterMs ?? null;
    this.priceBracket = priceBracket ?? null;
    this.approvalType = approvalType ?? null;
    this.policyVersionId = policyVersionId ?? null;
  }
}
