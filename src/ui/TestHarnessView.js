import { h } from './App.js';
import { encodeQrMatrix, renderQrSvg } from '../utils/qrEncoder.js';
import { COMPETITORS } from '../models/Submission.js';
import { SpreadConfigService } from '../services/SpreadConfigService.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const VIN_CHARSET = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ'; // excludes I/O/Q, matching real VIN rules
const HARNESS_COMPETITORS = ['CarMax', 'Carvana'];
const APPRAISAL_URL_FORMAT_PREFIX = 'carboyz-appraisal-v1';
const APPRAISAL_URL_FIELDS = ['vin', 'year', 'make', 'model', 'mileage', 'zipCode', 'competitor', 'competitorOfferAmount'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const PRICE_BRACKET_PRESETS = [
  {
    key: '5k',
    label: '$5k Bracket',
    offerRange: [4500, 5500],
    mileageBase: 120000,
    vehicles: [
      { year: 2011, make: 'Honda', model: 'Civic' },
      { year: 2010, make: 'Toyota', model: 'Corolla' },
      { year: 2009, make: 'Nissan', model: 'Altima' },
    ],
  },
  {
    key: '15k',
    label: '$15k Bracket',
    offerRange: [14000, 16000],
    mileageBase: 60000,
    vehicles: [
      { year: 2018, make: 'Toyota', model: 'Camry' },
      { year: 2017, make: 'Honda', model: 'CR-V' },
      { year: 2019, make: 'Chevrolet', model: 'Malibu' },
    ],
  },
  {
    key: '25k',
    label: '$25k Bracket',
    offerRange: [23000, 27000],
    mileageBase: 30000,
    vehicles: [
      { year: 2021, make: 'Jeep', model: 'Wrangler' },
      { year: 2022, make: 'Ford', model: 'Escape' },
      { year: 2021, make: 'Subaru', model: 'Outback' },
    ],
  },
  {
    key: '45k',
    label: '$45k Bracket',
    offerRange: [42000, 48000],
    mileageBase: 8000,
    vehicles: [
      { year: 2023, make: 'Ford', model: 'F-150' },
      { year: 2023, make: 'Chevrolet', model: 'Tahoe' },
      { year: 2022, make: 'Ram', model: '1500' },
    ],
  },
];

export const HISTORICAL_OUTCOME_PRESETS = [
  { key: 'AUTO_COUNTERED', status: 'AUTO_COUNTER_SENT', winLossStatus: 'AUTO_COUNTERED', approvalType: 'AUTO_DISPATCH' },
  { key: 'MANUAL_APPROVED', status: 'AUTO_COUNTER_SENT', winLossStatus: 'MANUAL_APPROVED', approvalType: 'HUMAN_APPROVED' },
  { key: 'WON', status: 'AUTO_COUNTER_SENT', winLossStatus: 'WON', approvalType: 'HUMAN_APPROVED' },
  { key: 'LOST', status: 'AUTO_COUNTER_SENT', winLossStatus: 'LOST', approvalType: 'HUMAN_APPROVED' },
];

function findBracket(bracketKey) {
  const bracket = PRICE_BRACKET_PRESETS.find((preset) => preset.key === bracketKey);
  if (!bracket) {
    throw new Error(`Unknown price bracket: ${bracketKey}`);
  }
  return bracket;
}

function pseudoRandomChar(seed, position) {
  const hash = Math.imul(seed + position * 2654435761, 2246822519) >>> 0;
  return VIN_CHARSET[hash % VIN_CHARSET.length];
}

/** Deterministic 17-char pseudo-VIN: same seedIndex always produces the same VIN. */
export function generateVin(seedIndex) {
  const seed = Math.abs(Math.trunc(seedIndex)) + 1;
  let vin = '';
  for (let position = 0; position < 17; position++) {
    vin += pseudoRandomChar(seed, position);
  }
  return vin;
}

/**
 * Builds a realistic seller-form-shaped appraisal for the given price bracket. Deterministic:
 * the same (bracketKey, seedIndex) always returns the same appraisal, so repeated harness clicks
 * with an incrementing seed produce varied-but-reproducible presets.
 */
export function buildMockAppraisal(bracketKey, seedIndex = 0) {
  const bracket = findBracket(bracketKey);
  const vehicle = bracket.vehicles[seedIndex % bracket.vehicles.length];
  const [min, max] = bracket.offerRange;
  const offsetFraction = (seedIndex % 7) / 7;
  const competitorOfferAmount = Math.round(min + (max - min) * offsetFraction);
  const competitor = HARNESS_COMPETITORS[seedIndex % HARNESS_COMPETITORS.length];
  const mileage = bracket.mileageBase + (seedIndex % 5) * 1500;

  return {
    vin: generateVin(seedIndex),
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: null,
    mileage,
    zipCode: '28451',
    competitor,
    competitorDealerName: null,
    competitorOfferAmount,
    offerDocument: null,
  };
}

/** Compact pipe-delimited encoding — smaller than JSON, so the resulting QR stays low-version. */
export function encodeAppraisalForUrl(appraisal) {
  const parts = [APPRAISAL_URL_FORMAT_PREFIX, ...APPRAISAL_URL_FIELDS.map((field) => String(appraisal[field]))];
  return parts.join('|');
}

/** Inverse of `encodeAppraisalForUrl`. Rejects (returns null) rather than partially parsing malformed input. */
export function decodeAppraisalFromUrlParam(raw) {
  if (typeof raw !== 'string') return null;
  const parts = raw.split('|');
  if (parts[0] !== APPRAISAL_URL_FORMAT_PREFIX || parts.length !== APPRAISAL_URL_FIELDS.length + 1) {
    return null;
  }
  const [, vin, year, make, model, mileage, zipCode, competitor, competitorOfferAmount] = parts;
  const parsedYear = Number(year);
  const parsedMileage = Number(mileage);
  const parsedOffer = Number(competitorOfferAmount);
  if (!vin || !make || !model || !zipCode || !competitor) return null;
  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMileage) || !Number.isFinite(parsedOffer)) return null;

  return {
    vin,
    year: parsedYear,
    make,
    model,
    trim: null,
    mileage: parsedMileage,
    zipCode,
    competitor,
    competitorDealerName: null,
    competitorOfferAmount: parsedOffer,
    offerDocument: null,
  };
}

export function buildPrefillUrl(baseUrl, appraisal) {
  return `${baseUrl}?tab=sell&pf=${encodeURIComponent(encodeAppraisalForUrl(appraisal))}`;
}

export function parsePrefillFromSearch(search) {
  const params = new URLSearchParams(search);
  const raw = params.get('pf');
  return raw ? decodeAppraisalFromUrlParam(raw) : null;
}

function formatBracketLabel(bracket) {
  const [min, max] = bracket.offerRange;
  return `${currencyFormatter.format(min)}-${currencyFormatter.format(max)}`;
}

/**
 * Pairs a `submissionService.submit()` payload with the `updateFields()` patch that immediately
 * follows it — required because `SubmissionService.submit()` hardcodes `status: 'NEW'` on intake,
 * the same two-step shape `DispatchService`/`LeadInboxController` already use to reach a resolved
 * state.
 */
export function buildHistoricalSubmissionPatch(bracketKey, outcomeKey, seedIndex) {
  const outcome = HISTORICAL_OUTCOME_PRESETS.find((preset) => preset.key === outcomeKey);
  if (!outcome) {
    throw new Error(`Unknown historical outcome: ${outcomeKey}`);
  }
  const bracket = findBracket(bracketKey);
  const appraisal = buildMockAppraisal(bracketKey, seedIndex);
  const daysAgo = (seedIndex % 90) + 1;
  const timestamp = new Date(Date.now() - daysAgo * MS_PER_DAY).toISOString();

  const spreadFactor = 0.03 + (seedIndex % 5) * 0.01;
  const calculatedCounterOffer = Math.round(appraisal.competitorOfferAmount * (1 + spreadFactor));
  const wholesaleEstimate = Math.round(appraisal.competitorOfferAmount * 1.12);
  const expectedMargin = wholesaleEstimate - calculatedCounterOffer;
  const timeToCounterMs = (5 + (seedIndex % 20)) * 60 * 1000;

  return {
    submitData: { ...appraisal, timestamp },
    updatePatch: {
      status: outcome.status,
      winLossStatus: outcome.winLossStatus,
      approvalType: outcome.approvalType,
      calculatedCounterOffer,
      finalCounterOffer: calculatedCounterOffer,
      expectedMargin,
      priceBracket: formatBracketLabel(bracket),
      timeToCounterMs,
    },
  };
}

/**
 * Seeds `count` synthetic historical leads (cycling deterministically through every
 * bracket x outcome combination) directly via `submissionService`. No DOM access — fully
 * unit-testable with a real or fake `SubmissionService`.
 */
export function seedHistoricalLeads(submissionService, { count = 50 } = {}) {
  const bracketKeys = PRICE_BRACKET_PRESETS.map((preset) => preset.key);
  const outcomeKeys = HISTORICAL_OUTCOME_PRESETS.map((preset) => preset.key);
  const created = [];

  for (let i = 0; i < count; i++) {
    const bracketKey = bracketKeys[i % bracketKeys.length];
    const outcomeKey = outcomeKeys[Math.floor(i / bracketKeys.length) % outcomeKeys.length];
    const { submitData, updatePatch } = buildHistoricalSubmissionPatch(bracketKey, outcomeKey, i);
    const submitted = submissionService.submit(submitData);
    created.push(submissionService.updateFields(submitted.id, updatePatch));
  }

  return created;
}

export const SYNTHETIC_MAKE_MODELS = [
  { make: 'Honda', model: 'Accord' },
  { make: 'Toyota', model: 'Camry' },
  { make: 'Ford', model: 'F-150' },
  { make: 'Chevrolet', model: 'Equinox' },
  { make: 'Jeep', model: 'Grand Cherokee' },
  { make: 'Subaru', model: 'Outback' },
  { make: 'Nissan', model: 'Rogue' },
  { make: 'Ram', model: '1500' },
];

// 'Hendrick' isn't in the Submission model's fixed COMPETITORS enum, so it maps to
// competitor: 'Other' with competitorDealerName: 'Hendrick' — the same shape a real seller
// submission takes when reporting an offer from an unlisted competitor.
export const SYNTHETIC_COMPETITOR_SOURCES = ['CarMax', 'Carvana', 'Hendrick'];

export const HISTORICAL_POOL_WINDOW_DAYS = [30, 60, 90];

function pseudoRandomInt(seed, max) {
  const hash = Math.imul(seed + 1, 2654435761) >>> 0;
  return hash % max;
}

/**
 * Builds one deterministic synthetic submission payload: same seedIndex + config always
 * produces the same output. `config.makes` (an array of make strings) filters
 * SYNTHETIC_MAKE_MODELS down to a selectable subset; an empty/omitted filter uses the full pool.
 */
export function buildSyntheticSubmission(seedIndex, { daysBack = 90, makes = null, competitorSources = SYNTHETIC_COMPETITOR_SOURCES } = {}) {
  const filteredPool = makes && makes.length > 0 ? SYNTHETIC_MAKE_MODELS.filter((entry) => makes.includes(entry.make)) : SYNTHETIC_MAKE_MODELS;
  const pool = filteredPool.length > 0 ? filteredPool : SYNTHETIC_MAKE_MODELS;
  const vehicle = pool[seedIndex % pool.length];
  const source = competitorSources[seedIndex % competitorSources.length];
  const isListedCompetitor = COMPETITORS.includes(source) && source !== 'Other';
  const competitor = isListedCompetitor ? source : 'Other';
  const competitorDealerName = isListedCompetitor ? null : source;

  const year = 2024 - (seedIndex % 9);
  const mileage = 6000 + pseudoRandomInt(seedIndex, 95) * 1000;
  const competitorOfferAmount = 11000 + pseudoRandomInt(seedIndex + 1, 380) * 100;
  const daysAgo = daysBack <= 1 ? 0 : pseudoRandomInt(seedIndex + 2, daysBack);
  const timestamp = new Date(Date.now() - daysAgo * MS_PER_DAY).toISOString();

  return {
    vin: generateVin(seedIndex + 100000),
    year,
    make: vehicle.make,
    model: vehicle.model,
    trim: null,
    mileage,
    zipCode: '28451',
    competitor,
    competitorDealerName,
    competitorOfferAmount,
    offerDocument: null,
    timestamp,
    daysAgo,
  };
}

/**
 * Builds `count` synthetic submission payloads across selectable date ranges (`daysBack`),
 * vehicle makes (`makes`), and competitor sources (`competitorSources`).
 */
export function buildSyntheticSubmissions(count, config = {}) {
  return Array.from({ length: count }, (_, seedIndex) => buildSyntheticSubmission(seedIndex, config));
}

/**
 * Seeds a sequential policy version timeline (v1.0.0 -> v1.1.0 -> v1.2.0, when starting from a
 * fresh/default config) into AuditLedgerService via SpreadConfigService, backdating each mutation
 * across `daysBack` so the ledger reads as real history. Returns the resulting segments — each
 * the policyVersionId active from `daysAgo` days ago up to the next (more recent) segment — used
 * by resolveActivePolicyVersion() to tag generated submissions with the version that was active
 * at their timestamp.
 */
export function seedHistoricalPolicyTimeline({ tenantId, storage = null, spreadConfigService = null, daysBack = 90, authorId = 'system-seed', versionCount = 3 } = {}) {
  const service = spreadConfigService ?? new SpreadConfigService({ tenantId, storage });
  const auditLedgerService = service.auditLedgerService;
  const originalNow = auditLedgerService.now;
  const segments = [];

  try {
    for (let index = 0; index < versionCount; index++) {
      const daysAgo = Math.round((daysBack * (versionCount - index)) / versionCount);
      const backdatedTimestamp = new Date(Date.now() - daysAgo * MS_PER_DAY).toISOString();
      auditLedgerService.now = () => backdatedTimestamp;

      if (index === 0) {
        // Establishes the starting version as an explicit ledger entry rather than leaving it
        // as an untimestamped constructor default.
        service.applyConfig(service.getConfig(), authorId);
      } else {
        service.saveConfig(service.getConfig(), { authorId });
      }

      segments.push({ policyVersionId: service.getActivePolicyVersionId(), daysAgo });
    }
  } finally {
    auditLedgerService.now = originalNow;
  }

  return { spreadConfigService: service, segments };
}

/** The policyVersionId active `daysAgo` days before now, per the segments from seedHistoricalPolicyTimeline(). */
export function resolveActivePolicyVersion(segments, daysAgo) {
  const oldestFirst = [...segments].sort((a, b) => b.daysAgo - a.daysAgo);
  const newestFirst = [...segments].sort((a, b) => a.daysAgo - b.daysAgo);
  const match = newestFirst.find((segment) => segment.daysAgo >= daysAgo);
  return (match ?? oldestFirst[0]).policyVersionId;
}

/**
 * One-click historical population: seeds a policy version timeline across `days`, generates
 * `count` synthetic submissions across that same window, and submits each one tagged with the
 * policyVersionId that was active at its timestamp.
 */
export function seedHistoricalSubmissionPool({ submissionService, tenantId, storage = null, spreadConfigService = null, days = 90, count = 60, config = {} } = {}) {
  if (!submissionService) {
    throw new Error('seedHistoricalSubmissionPool requires a submissionService');
  }

  const { segments } = seedHistoricalPolicyTimeline({
    tenantId: tenantId ?? submissionService.tenantId,
    storage: storage ?? submissionService.storage,
    spreadConfigService,
    daysBack: days,
  });
  const generated = buildSyntheticSubmissions(count, { ...config, daysBack: days });

  return generated.map(({ daysAgo, ...submitData }) =>
    submissionService.submit({ ...submitData, policyVersionId: resolveActivePolicyVersion(segments, daysAgo) }),
  );
}

function renderAppraisalPreview(appraisal) {
  return h('dl', { class: 'harness__preview-list' }, [
    h('dt', { text: 'VIN' }),
    h('dd', { text: appraisal.vin }),
    h('dt', { text: 'Vehicle' }),
    h('dd', { text: `${appraisal.year} ${appraisal.make} ${appraisal.model}` }),
    h('dt', { text: 'Mileage' }),
    h('dd', { text: `${appraisal.mileage.toLocaleString()} mi` }),
    h('dt', { text: 'Competitor' }),
    h('dd', { text: appraisal.competitor }),
    h('dt', { text: 'Competitor Offer' }),
    h('dd', { text: currencyFormatter.format(appraisal.competitorOfferAmount) }),
  ]);
}

/**
 * The interactive Test Harness / Sandbox tab: live appraisal + QR generator, one-click inject,
 * and the batch historical seeder. Untested (DOM-rendering function), same tier as
 * `renderLeadInboxView`/`renderSellerSubmissionView`.
 */
export function renderTestHarnessView({ sellerController, submissionService, spreadConfigService = null }) {
  let seedCounter = 0;
  let currentAppraisal = null;

  const previewEl = h('div', { class: 'harness__preview' }, [
    h('p', { class: 'empty-state', text: 'Pick a price bracket to generate a live appraisal.' }),
  ]);
  const qrContainer = h('div', { class: 'harness__qr' });
  const injectStatusEl = h('p', { class: 'form__status', role: 'status', 'aria-live': 'polite' });
  const seedStatusEl = h('p', { class: 'form__status', role: 'status', 'aria-live': 'polite' });

  const injectBtn = h('button', {
    class: 'button',
    type: 'button',
    text: 'Simulate Camera Snap / Inject Submission',
    disabled: '',
  });

  function generate(bracketKey) {
    currentAppraisal = buildMockAppraisal(bracketKey, seedCounter);
    seedCounter += 1;
    previewEl.replaceChildren(renderAppraisalPreview(currentAppraisal));

    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const url = buildPrefillUrl(baseUrl, currentAppraisal);
    const matrix = encodeQrMatrix(url, { errorCorrectionLevel: 'L' });
    qrContainer.innerHTML = renderQrSvg(matrix, { cellSize: 4, margin: 8 });

    injectBtn.disabled = false;
    injectStatusEl.textContent = '';
  }

  const bracketButtons = h(
    'div',
    { class: 'harness__brackets' },
    PRICE_BRACKET_PRESETS.map((bracket) =>
      h('button', {
        class: 'button button--secondary',
        type: 'button',
        text: bracket.label,
        onClick: () => generate(bracket.key),
      }),
    ),
  );

  injectBtn.addEventListener('click', () => {
    if (!currentAppraisal) return;
    const { submission, pendingSessionId } = sellerController.submitSubmission(currentAppraisal);
    injectStatusEl.textContent = pendingSessionId
      ? `Injected ${submission.id} — pending sign-off in the Lead Inbox.`
      : `Injected ${submission.id} — auto-countered.`;
  });

  const seedBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Seed 50 Historical Leads' });
  seedBtn.addEventListener('click', () => {
    const created = seedHistoricalLeads(submissionService, { count: 50 });
    seedStatusEl.textContent = `Seeded ${created.length} historical leads.`;
  });

  const poolStatusEl = h('p', { class: 'form__status', role: 'status', 'aria-live': 'polite' });
  const poolButtons = h(
    'div',
    { class: 'harness__pool-buttons' },
    HISTORICAL_POOL_WINDOW_DAYS.map((days) =>
      h('button', {
        class: 'button button--secondary',
        type: 'button',
        text: `Seed ${days}-Day Pool`,
        onClick: () => {
          const created = seedHistoricalSubmissionPool({ submissionService, spreadConfigService, days, count: days });
          poolStatusEl.textContent = `Seeded ${created.length} submissions across a ${days}-day policy timeline.`;
        },
      }),
    ),
  );

  const section = h('section', { class: 'view', id: 'view-harness' }, [
    h('h2', { text: 'Test Harness' }),
    h('p', {
      class: 'view__subtitle',
      text: 'Generate live appraisals, scan the QR, and seed historical data for demos.',
    }),
    h('h3', { text: 'Live Appraisal Generator' }),
    bracketButtons,
    previewEl,
    qrContainer,
    injectBtn,
    injectStatusEl,
    h('h3', { text: 'Batch Historical Data Seeder' }),
    seedBtn,
    seedStatusEl,
    h('h3', { text: 'Historical Submission + Policy Timeline Pool' }),
    poolButtons,
    poolStatusEl,
  ]);

  return { section };
}
