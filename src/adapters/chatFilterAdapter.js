import { evaluateVehicleMarketPosition } from './marketEvaluationAdapter.js';
import { deriveVehicleCondition } from '../ui/vehicleCard.js';

const BODY_STYLE_ALIASES = {
  suv: 'suv',
  suvs: 'suv',
  sedan: 'sedan',
  sedans: 'sedan',
  truck: 'truck',
  trucks: 'truck',
  pickup: 'truck',
  coupe: 'coupe',
  coupes: 'coupe',
  hatchback: 'hatchback',
  hatchbacks: 'hatchback',
  van: 'van',
  vans: 'van',
  minivan: 'van',
};

const BUDGET_PATTERN = /(?:under|below|less than|max(?:imum)?|up to)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?\b(?!\s*(?:miles|mi\b))/;
const MILEAGE_PATTERN = /(?:under|below|less than|max(?:imum)?|up to)\s*([\d,]+(?:\.\d+)?)\s*(k)?\s*(?:miles|mi\b)/;
const LOW_MILES_PATTERN = /\blow\s*miles\b|\blow\s*mileage\b/;
const DEFAULT_LOW_MILEAGE = 30000;

const YEAR_RANGE_PATTERN = /\b(\d{4})\s*(?:-|to|–)\s*(\d{4})\b/;
const YEAR_AFTER_PATTERN = /\b(?:after|since|newer than|from)\s*(\d{4})\b/;
const YEAR_OR_NEWER_PATTERN = /\b(\d{4})\s*or newer\b/;
const YEAR_BEFORE_PATTERN = /\b(?:before|older than)\s*(\d{4})\b/;

function parseMagnitude(rawValue, hasThousandsSuffix) {
  const value = Number(rawValue.replace(/,/g, ''));
  return hasThousandsSuffix ? value * 1000 : value;
}

function parseBodyStyle(text) {
  for (const [alias, bodyStyle] of Object.entries(BODY_STYLE_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(text)) {
      return bodyStyle;
    }
  }
  return undefined;
}

function parseMaxMileage(text) {
  const mileageMatch = text.match(MILEAGE_PATTERN);
  if (mileageMatch) {
    return parseMagnitude(mileageMatch[1], Boolean(mileageMatch[2]));
  }
  return LOW_MILES_PATTERN.test(text) ? DEFAULT_LOW_MILEAGE : undefined;
}

function parseYearRange(text) {
  const rangeMatch = text.match(YEAR_RANGE_PATTERN);
  if (rangeMatch) {
    return { minYear: Number(rangeMatch[1]), maxYear: Number(rangeMatch[2]) };
  }

  const range = {};
  const afterMatch = text.match(YEAR_AFTER_PATTERN) ?? text.match(YEAR_OR_NEWER_PATTERN);
  if (afterMatch) {
    range.minYear = Number(afterMatch[1]);
  }
  const beforeMatch = text.match(YEAR_BEFORE_PATTERN);
  if (beforeMatch) {
    range.maxYear = Number(beforeMatch[1]);
  }
  return range;
}

/**
 * Parses a free-text conversational query ("Looking for an SUV under $30k with low miles...")
 * into structured search criteria: budget, body style, year range, and max mileage.
 */
export function parseChatQuery(text = '') {
  const lower = text.toLowerCase();
  const query = {};

  const bodyStyle = parseBodyStyle(lower);
  if (bodyStyle) query.bodyStyle = bodyStyle;

  const budgetMatch = lower.match(BUDGET_PATTERN);
  if (budgetMatch) {
    query.maxPrice = parseMagnitude(budgetMatch[1], Boolean(budgetMatch[2]));
  }

  const maxMileage = parseMaxMileage(lower);
  if (maxMileage !== undefined) query.maxMileage = maxMileage;

  Object.assign(query, parseYearRange(lower));

  return query;
}

/** Filters a vehicle pool down to those matching a parsed chat query's criteria. */
export function filterVehiclesByQuery(vehicles, query = {}) {
  return vehicles.filter((vehicle) => {
    if (query.bodyStyle !== undefined && vehicle.bodyStyle !== query.bodyStyle) return false;
    if (query.maxPrice !== undefined && vehicle.price > query.maxPrice) return false;
    if (query.maxMileage !== undefined && (vehicle.mileage === null || vehicle.mileage > query.maxMileage)) return false;
    if (query.minYear !== undefined && (vehicle.year === null || vehicle.year < query.minYear)) return false;
    if (query.maxYear !== undefined && (vehicle.year === null || vehicle.year > query.maxYear)) return false;
    if (query.conditionPreference?.length) {
      const preferences = query.conditionPreference.map((preference) => preference.toLowerCase());
      if (!preferences.includes(deriveVehicleCondition(vehicle).toLowerCase())) return false;
    }
    return true;
  });
}

/**
 * Filters the inventory pool by a parsed chat query, evaluates each surviving candidate against
 * local market comps, and returns the top N best-value matches (most underpriced first).
 */
export function rankTopMatches(vehicles, dealers, query = {}, { topN = 5 } = {}) {
  const dealersById = new Map(dealers.map((dealer) => [dealer.dealerId, dealer]));
  const filtered = filterVehiclesByQuery(vehicles, query);

  const evaluated = filtered
    .map((vehicle) => ({
      vehicle,
      dealer: dealersById.get(vehicle.dealerId) ?? null,
      evaluation: evaluateVehicleMarketPosition(vehicle, { vehicles, dealers }),
    }))
    .filter((entry) => entry.evaluation !== null);

  evaluated.sort((a, b) => a.evaluation.percentageDelta - b.evaluation.percentageDelta);

  return evaluated.slice(0, topN);
}

const LLM_API_URL = 'https://api.anthropic.com/v1/messages';
const LLM_MODEL = 'claude-haiku-4-5-20251001';
const LLM_TIMEOUT_MS = 6000;
const VALID_BODY_STYLES = new Set(['SUV', 'Sedan', 'Truck', 'Coupe', 'Hatchback']);

const LLM_SYSTEM_PROMPT = `Extract structured vehicle search parameters from a car buyer's message.
Respond with ONLY a JSON object (no prose, no markdown fences) matching this shape, omitting any
field the message does not specify:
{"maxPrice": number, "maxMileage": number, "minYear": number, "bodyStyle": "SUV" | "Sedan" | "Truck" | "Coupe" | "Hatchback", "conditionPreference": string[], "intentSummary": string}
"intentSummary" is always required: one short natural-language sentence describing what the buyer wants.`;

/** Reads an Anthropic API key from explicit options, then the environment, then a browser global — never throws. */
function resolveApiKey(options = {}) {
  if (typeof options.apiKey === 'string' && options.apiKey) return options.apiKey;
  if (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (typeof window !== 'undefined' && window.CARBOYZ_ANTHROPIC_API_KEY) return window.CARBOYZ_ANTHROPIC_API_KEY;
  return null;
}

function extractJsonObject(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/** Validates and normalizes a raw LLM JSON payload into the internal query shape (lowercase bodyStyle). */
function sanitizeLlmQuery(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const query = {};
  if (typeof raw.maxPrice === 'number' && raw.maxPrice >= 0) query.maxPrice = raw.maxPrice;
  if (typeof raw.maxMileage === 'number' && raw.maxMileage >= 0) query.maxMileage = raw.maxMileage;
  if (typeof raw.minYear === 'number') query.minYear = raw.minYear;
  if (typeof raw.bodyStyle === 'string' && VALID_BODY_STYLES.has(raw.bodyStyle)) {
    query.bodyStyle = raw.bodyStyle.toLowerCase();
  }
  if (Array.isArray(raw.conditionPreference)) {
    const preferences = raw.conditionPreference.filter((entry) => typeof entry === 'string' && entry.trim());
    if (preferences.length) query.conditionPreference = preferences;
  }
  query.intentSummary = typeof raw.intentSummary === 'string' && raw.intentSummary.trim() ? raw.intentSummary.trim() : null;

  return query;
}

/**
 * Calls an LLM to extract structured search parameters from a natural-language buyer query.
 * Returns null (never throws) when no API key is configured, `fetch` is unavailable, the request
 * fails or times out, or the response can't be parsed into a valid query — callers should fall
 * back to `parseChatQuery()` in that case.
 */
export async function parseChatQueryWithLLM(text = '', options = {}) {
  const apiKey = resolveApiKey(options);
  // A bare `fetch` reference throws "Illegal invocation" when called detached from `window`
  // (the spec's branding check) — bind it so the default path works in a real browser.
  const fetchImpl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  if (!apiKey || !fetchImpl || !text.trim()) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), options.timeoutMs ?? LLM_TIMEOUT_MS) : null;

  try {
    const response = await fetchImpl(LLM_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: options.model ?? LLM_MODEL,
        max_tokens: 300,
        system: LLM_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
      signal: controller?.signal,
    });

    if (!response.ok) return null;

    const payload = await response.json();
    const rawText = payload?.content?.[0]?.text;
    if (typeof rawText !== 'string') return null;

    return sanitizeLlmQuery(extractJsonObject(rawText));
  } catch {
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** Builds a natural-language intentSummary for the regex-parser fallback path. */
function buildFallbackIntentSummary(text, query) {
  const parts = [];
  if (query.bodyStyle) parts.push(query.bodyStyle);
  if (query.maxPrice !== undefined) parts.push(`under $${query.maxPrice.toLocaleString()}`);
  if (query.maxMileage !== undefined) parts.push(`under ${query.maxMileage.toLocaleString()} miles`);
  if (query.minYear !== undefined) parts.push(`${query.minYear} or newer`);
  if (query.maxYear !== undefined) parts.push(`before ${query.maxYear}`);
  return parts.length ? `Looking for a ${parts.join(', ')}.` : text.trim();
}

/**
 * Resolves a natural-language buyer query into structured search criteria: tries the LLM parser
 * first, and falls back to the deterministic regex parser (`parseChatQuery`) whenever no API key
 * is configured, the LLM is unreachable, or its output fails validation.
 */
export async function resolveChatQuery(text = '', options = {}) {
  const llmQuery = await parseChatQueryWithLLM(text, options);
  if (llmQuery) return llmQuery;

  const regexQuery = parseChatQuery(text);
  return { ...regexQuery, intentSummary: buildFallbackIntentSummary(text, regexQuery) };
}
