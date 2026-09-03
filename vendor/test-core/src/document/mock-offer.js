const MS_PER_DAY = 24 * 60 * 60 * 1000;

function defaultExpiresOn() {
  return new Date(Date.now() + 7 * MS_PER_DAY).toISOString().slice(0, 10);
}

function formatCurrency(amount) {
  return `$${Number(amount).toLocaleString('en-US')}`;
}

// Field names below mirror the layouts real offer sheets use, so parser/OCR test fixtures exercise
// the same structural cues a production document-intake pipeline would look for.
const OFFER_TEMPLATES = {
  CarMax: (data) =>
    [
      'CARMAX WRITTEN OFFER',
      `CarMax Store #${data.storeNumber}`,
      `VIN: ${data.vin}`,
      `Mileage: ${Number(data.mileage).toLocaleString('en-US')}`,
      `7-Day Offer Amount: ${formatCurrency(data.offerAmount)}`,
      `Offer Expires: ${data.expiresOn}`,
    ].join('\n'),
  Carvana: (data) =>
    [
      'CARVANA APPRAISAL OFFER',
      `Carvana Cash Offer: ${formatCurrency(data.offerAmount)}`,
      `VIN: ${data.vin}`,
      `Vehicle Description: ${[data.year, data.make, data.model].filter(Boolean).join(' ')}`,
      `Expiration Date: ${data.expiresOn}`,
    ].join('\n'),
  KBB: (data) =>
    [
      'KBB INSTANT CASH OFFER',
      `Participating Dealer Offer: ${formatCurrency(data.offerAmount)}`,
      `Offer Code: ${data.offerCode}`,
      `VIN: ${data.vin}`,
      `Valid Through: ${data.expiresOn}`,
    ].join('\n'),
  Hendrick: (data) =>
    [
      'HENDRICK AUTOMOTIVE GROUP - APPRAISAL OFFER',
      `Location: ${data.storeName}`,
      `Vehicle: ${[data.year, data.make, data.model].filter(Boolean).join(' ')}`,
      `VIN: ${data.vin}`,
      `Mileage: ${Number(data.mileage).toLocaleString('en-US')}`,
      `Guaranteed Trade Value: ${formatCurrency(data.offerAmount)}`,
      `Offer Valid Until: ${data.expiresOn}`,
    ].join('\n'),
};

export const SUPPORTED_COMPETITORS = Object.keys(OFFER_TEMPLATES);

/**
 * Builds a synthetic offer sheet for `competitor` (CarMax/Carvana/KBB/Hendrick) from an appraisal-shaped
 * payload. Returns both the rendered `text` (for OCR/parser fixtures) and the structured `payload`
 * that produced it (for assertions against the parser's expected extraction).
 */
export function generateMockOffer(competitor, appraisal) {
  const template = OFFER_TEMPLATES[competitor];
  if (!template) {
    throw new Error(`Unknown competitor: ${competitor}. Supported: ${SUPPORTED_COMPETITORS.join(', ')}`);
  }
  if (!appraisal || typeof appraisal.vin !== 'string' || typeof appraisal.offerAmount !== 'number') {
    throw new Error('generateMockOffer requires an appraisal with at least { vin, offerAmount }');
  }

  const data = {
    storeNumber: '7042',
    storeName: 'Hendrick Chevrolet',
    offerCode: `KBB-${appraisal.vin.slice(-6)}`,
    expiresOn: defaultExpiresOn(),
    ...appraisal,
  };

  return {
    competitor,
    text: template(data),
    payload: data,
  };
}
