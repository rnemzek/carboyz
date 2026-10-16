export const COMPETITORS = ['CarMax', 'Carvana', 'KBB', 'GiveMeTheVin', 'Other'];
export const SUBMISSION_STATUSES = [
  'NEW',
  'IN_REVIEW',
  'OFFER_BEATEN',
  'DECLINED',
  'PENDING_APPROVAL',
  'AUTO_COUNTER_SENT',
  'REJECTED',
];
// Desk "Pass / Reject Lead" workflow (UOW-49): the key is the persisted rejectionReason value,
// the value is its human-readable label for the rejection modal and lead card.
export const REJECTION_REASONS = Object.freeze({
  COMPETITOR_OVER_RETAIL: 'Competitor offer exceeds market retail',
  TITLE_OR_CONDITION_ISSUE: 'Title brand, NMVTIS, or physical condition risk',
  INVENTORY_SATURATION: 'Dealership overstocked on this make/model',
  CUSTOMER_UNRESPONSIVE: 'Unable to contact seller',
  OTHER: 'Other reason',
});
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
// 'ESTIMATE': the competitor offer came from a VIN-less "Estimate" screen (see offerParser.js's
// isEstimate extraction) and hasn't been inspection/VIN-verified yet. 'FIRM_OFFER': a real,
// VIN-bearing competitor offer document or a seller-confirmed VIN. Drives the appraisal sheet's
// "Conditional" vs "Guaranteed" counter-offer label and the Lead Inbox provenance badge.
export const OFFER_SOURCE_TYPES = ['ESTIMATE', 'FIRM_OFFER'];

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
    lat,
    lng,
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
    offerSourceType = 'FIRM_OFFER',
    isAutoApproved,
    priceTierBucket,
    projectedMargin,
    rejectionReason,
    rejectionNotes,
    nagSentAt,
    queuedForMorningDigest,
    digestSentAt,
    modifiedBy,
    modifiedAt,
  }) {
    if (!id) {
      throw new Error('Submission requires an id');
    }
    if (!timestamp) {
      throw new Error('Submission requires a timestamp');
    }
    // A VIN-less "Estimate" screen (Carvana's instant quote, etc.) never has a VIN at intake —
    // UOW-47 allows submitting that no-VIN preliminary counter, upgraded to the full verified-VIN
    // tier later if the seller supplies one. Any other offerSourceType still requires a vin.
    if (!vin && offerSourceType !== 'ESTIMATE') {
      throw new Error('Submission requires a vin');
    }
    // UOW-51: year/make/model are no longer collected via manual form entry, so a VIN decode or
    // document-OCR miss (unlisted VIN, NHTSA API down, low-confidence parse) must not block a
    // submission — they're nullable, same as trim, to be filled in later during desk review.
    validateOptionalNumber(year, 'year');
    if (make !== undefined && make !== null && typeof make !== 'string') {
      throw new Error('Submission make must be a string');
    }
    if (model !== undefined && model !== null && typeof model !== 'string') {
      throw new Error('Submission model must be a string');
    }
    if (typeof mileage !== 'number' || Number.isNaN(mileage) || mileage <= 0) {
      throw new Error('Submission requires a positive mileage');
    }
    if (zipCode !== undefined && zipCode !== null && typeof zipCode !== 'string') {
      throw new Error('Submission zipCode must be a string');
    }
    // Acquisition Radar (UOW-52): an explicit GPS fix takes priority over zipCode gazetteer
    // resolution, so both must be present together or not at all — lat/lng ride the globe,
    // allowNegative covers the southern/western hemispheres.
    validateOptionalNumber(lat, 'lat', { allowNegative: true });
    validateOptionalNumber(lng, 'lng', { allowNegative: true });
    if ((lat === undefined || lat === null) !== (lng === undefined || lng === null)) {
      throw new Error('Submission lat and lng must both be present or both be absent');
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
    if (!OFFER_SOURCE_TYPES.includes(offerSourceType)) {
      throw new Error(`Submission offerSourceType must be one of: ${OFFER_SOURCE_TYPES.join(', ')}`);
    }
    if (isAutoApproved !== undefined && isAutoApproved !== null && typeof isAutoApproved !== 'boolean') {
      throw new Error('Submission isAutoApproved must be a boolean');
    }
    if (priceTierBucket !== undefined && priceTierBucket !== null && typeof priceTierBucket !== 'string') {
      throw new Error('Submission priceTierBucket must be a string');
    }
    validateOptionalNumber(projectedMargin, 'projectedMargin', { allowNegative: true });
    if (
      rejectionReason !== undefined &&
      rejectionReason !== null &&
      !Object.keys(REJECTION_REASONS).includes(rejectionReason)
    ) {
      throw new Error(`Submission rejectionReason must be one of: ${Object.keys(REJECTION_REASONS).join(', ')}`);
    }
    if (status === 'REJECTED' && !rejectionReason) {
      throw new Error('Submission requires a rejectionReason when status is REJECTED');
    }
    if (rejectionNotes !== undefined && rejectionNotes !== null && typeof rejectionNotes !== 'string') {
      throw new Error('Submission rejectionNotes must be a string');
    }
    if (nagSentAt !== undefined && nagSentAt !== null && typeof nagSentAt !== 'string') {
      throw new Error('Submission nagSentAt must be a string');
    }
    if (digestSentAt !== undefined && digestSentAt !== null && typeof digestSentAt !== 'string') {
      throw new Error('Submission digestSentAt must be a string');
    }
    if (modifiedBy !== undefined && modifiedBy !== null && typeof modifiedBy !== 'string') {
      throw new Error('Submission modifiedBy must be a string');
    }
    if (modifiedAt !== undefined && modifiedAt !== null && typeof modifiedAt !== 'string') {
      throw new Error('Submission modifiedAt must be a string');
    }

    this.id = id;
    this.timestamp = timestamp;
    this.vin = vin || null;
    this.year = year ?? null;
    this.make = make ?? null;
    this.model = model ?? null;
    this.trim = trim ?? null;
    this.mileage = mileage;
    this.zipCode = zipCode ?? null;
    this.lat = lat ?? null;
    this.lng = lng ?? null;
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
    this.offerSourceType = offerSourceType;
    this.isAutoApproved = isAutoApproved ?? null;
    this.priceTierBucket = priceTierBucket ?? null;
    this.projectedMargin = projectedMargin ?? null;
    this.rejectionReason = rejectionReason ?? null;
    this.rejectionNotes = rejectionNotes ?? null;
    this.nagSentAt = nagSentAt ?? null;
    this.queuedForMorningDigest = Boolean(queuedForMorningDigest);
    this.digestSentAt = digestSentAt ?? null;
    this.modifiedBy = modifiedBy ?? null;
    this.modifiedAt = modifiedAt ?? null;
  }
}
