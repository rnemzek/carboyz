import { COMPETITORS } from '../models/Submission.js';

const PARSE_ENDPOINT = '/api/offers/parse';

/**
 * POSTs a dropped/captured offer document to the server parser. Never throws — a network
 * failure, non-OK response, or malformed JSON degrades to a no-op result so the dropzone upload
 * still succeeds and the seller can fill the form manually.
 */
export async function requestOfferParse({ documentBase64, mimeType, fetchImpl = fetch, endpoint = PARSE_ENDPOINT } = {}) {
  if (!documentBase64) {
    return { success: false, extracted: {}, confidence: {} };
  }

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentBase64, mimeType }),
    });
    if (!response.ok) {
      return { success: false, extracted: {}, confidence: {} };
    }
    const body = await response.json();
    return {
      success: Boolean(body?.success),
      extracted: body?.extracted ?? {},
      confidence: body?.confidence ?? {},
    };
  } catch {
    return { success: false, extracted: {}, confidence: {} };
  }
}

/**
 * Maps a parser result's `extracted` payload onto SellerSubmissionView's form field shape.
 * `competitorName` is freeform (it may be a generic dealership heading), so it only maps to the
 * `competitor` select when it matches one of the known `COMPETITORS`; otherwise it falls back to
 * `competitorDealerName` under the "Other" option, same as a seller typing it in by hand.
 */
export function mapExtractedOfferToFormValues(extracted = {}) {
  const knownCompetitors = COMPETITORS.filter((name) => name !== 'Other');
  const rawName = typeof extracted.competitorName === 'string' ? extracted.competitorName.trim() : '';
  const matched = knownCompetitors.find((name) => name.toLowerCase() === rawName.toLowerCase()) ?? null;

  return {
    vin: extracted.vin ?? null,
    year: extracted.year ?? null,
    make: extracted.make ?? null,
    model: extracted.model ?? null,
    mileage: extracted.mileage ?? null,
    competitorOfferAmount: extracted.competitorOffer ?? null,
    competitor: matched,
    competitorDealerName: matched ? null : rawName || null,
  };
}
