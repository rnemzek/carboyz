import { h } from '../../ui/App.js';
import { calculateSpread } from '../../services/SpreadService.js';
import { VEHICLE_SEEDS, decodeVIN, isValidVin } from '@nemzilla/test-core';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const BASE_VALUE_BY_BODY_CLASS = {
  Sedan: 18000,
  SUV: 24000,
  Pickup: 28000,
  Truck: 28000,
  Coupe: 17000,
  Hatchback: 15000,
  Van: 20000,
  Minivan: 20000,
};
const DEFAULT_BASE_VALUE = 18000;

const MANUAL_FALLBACK_FIELDS = { year: null, make: null, model: null, trim: null, bodyClass: null, engineCylinders: null, driveType: null };

/**
 * Sandbox-only CarMax offer estimate: no market telemetry backs this (the production path is
 * DispatchService.resolveFairMarketValue against live inventory), just a body-class base value
 * depreciated by age and mileage — enough to exercise the counter-offer threshold math below.
 */
export function estimateCarMaxOffer({ year, bodyClass, mileage } = {}) {
  const base = BASE_VALUE_BY_BODY_CLASS[bodyClass] ?? DEFAULT_BASE_VALUE;
  const age = Math.max(0, new Date().getFullYear() - (year ?? new Date().getFullYear()));
  const ageFactor = Math.max(0.35, 1 - age * 0.07);
  const mileageFactor = Math.max(0.5, 1 - Math.max(0, (mileage ?? 0) - 12000) / 200000);
  return Math.round(base * ageFactor * mileageFactor);
}

/** Wires the sandbox offer estimate into the real tier/threshold logic (SpreadService.calculateSpread). */
export function buildCounterOfferPreview({ estimatedOffer, spreadConfigService }) {
  const tierConfig = spreadConfigService.getTiersForCompetitor('CarMax');
  return calculateSpread({ competitorOfferAmount: estimatedOffer, tierConfig });
}

/**
 * Resolves a vehicle from a VIN: an invalid checksum, or a failed/thrown NHTSA decode, both fall
 * back to a manual-entry shape (null specs, source: 'manual-fallback') rather than an error state —
 * matches the documented NHTSA-lookup-failure behavior in docs/TEST_NOTES.md. `decodeVIN` is an
 * injection point so this stays testable without a real network call.
 */
export async function resolveVehicleFromVin(vin, { decodeVIN: decode = decodeVIN } = {}) {
  const normalizedVin = typeof vin === 'string' ? vin.trim().toUpperCase() : '';

  if (!isValidVin(normalizedVin)) {
    return { vin: normalizedVin, mileage: 0, ...MANUAL_FALLBACK_FIELDS, source: 'manual-fallback', reason: 'invalid-checksum' };
  }

  try {
    const decoded = await decode(normalizedVin);
    return { vin: normalizedVin, mileage: 0, ...decoded, source: 'nhtsa' };
  } catch (error) {
    return {
      vin: normalizedVin,
      mileage: 0,
      ...MANUAL_FALLBACK_FIELDS,
      source: 'manual-fallback',
      reason: error?.message ?? 'nhtsa-decode-failed',
    };
  }
}

function renderSpecList(vehicle) {
  return h('dl', { class: 'testbed__spec-list' }, [
    h('dt', { text: 'VIN' }),
    h('dd', { text: vehicle.vin }),
    h('dt', { text: 'Year' }),
    h('dd', { text: vehicle.year != null ? String(vehicle.year) : '—' }),
    h('dt', { text: 'Make' }),
    h('dd', { text: vehicle.make ?? '—' }),
    h('dt', { text: 'Model' }),
    h('dd', { text: vehicle.model ?? '—' }),
    h('dt', { text: 'Trim' }),
    h('dd', { text: vehicle.trim ?? '—' }),
    h('dt', { text: 'Body Class' }),
    h('dd', { text: vehicle.bodyClass ?? '—' }),
    h('dt', { text: 'Engine Cylinders' }),
    h('dd', { text: vehicle.engineCylinders != null ? String(vehicle.engineCylinders) : '—' }),
    h('dt', { text: 'Drive Type' }),
    h('dd', { text: vehicle.driveType ?? '—' }),
    h('dt', { text: 'Mileage' }),
    h('dd', { text: vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} mi` : '—' }),
  ]);
}

function renderOfferList({ estimatedOffer, spreadResult }) {
  return h('dl', { class: 'testbed__offer-list' }, [
    h('dt', { text: 'Est. CarMax Offer' }),
    h('dd', { text: currencyFormatter.format(estimatedOffer) }),
    h('dt', { text: 'Recommended Counter' }),
    h('dd', { text: currencyFormatter.format(spreadResult.recommendedCounterOffer) }),
    h('dt', { text: 'Threshold Status' }),
    h('dd', { text: spreadResult.status }),
  ]);
}

/**
 * Developer Test Bed: a slide-out drawer (not a tab) for picking a preset vehicle or decoding an
 * arbitrary VIN via NHTSA, then previewing the estimated CarMax offer and the real counter-offer
 * threshold calculation for it. Untested DOM-rendering function — same tier as
 * renderLeadInboxView/renderTestHarnessView; the logic it wires together is unit-tested above.
 */
export function renderTestBedDrawer({ spreadConfigService }) {
  let open = false;

  const statusEl = h('p', { class: 'form__status', role: 'status', 'aria-live': 'polite' });
  const specsEl = h('div', { class: 'testbed__specs' }, [
    h('p', { class: 'empty-state', text: 'Pick a preset or decode a VIN to see specs.' }),
  ]);
  const offerEl = h('div', { class: 'testbed__offer' });

  function showVehicle(vehicle) {
    specsEl.replaceChildren(renderSpecList(vehicle));
    const estimatedOffer = estimateCarMaxOffer(vehicle);
    const spreadResult = buildCounterOfferPreview({ estimatedOffer, spreadConfigService });
    offerEl.replaceChildren(renderOfferList({ estimatedOffer, spreadResult }));
  }

  const presetSelect = h(
    'select',
    { class: 'testbed__preset-select' },
    [
      h('option', { value: '', text: 'Select a preset vehicle…' }),
      ...VEHICLE_SEEDS.map((seed) => h('option', { value: seed.key, text: seed.label })),
    ],
  );
  presetSelect.addEventListener('change', () => {
    const seed = VEHICLE_SEEDS.find((candidate) => candidate.key === presetSelect.value);
    if (!seed) return;
    statusEl.textContent = `Loaded preset: ${seed.label}`;
    showVehicle(seed);
  });

  const vinInput = h('input', { type: 'text', class: 'testbed__vin-input', placeholder: 'Enter 17-char VIN', maxlength: '17' });
  const decodeBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Decode VIN' });
  decodeBtn.addEventListener('click', async () => {
    statusEl.textContent = 'Decoding via NHTSA…';
    decodeBtn.disabled = true;
    try {
      const vehicle = await resolveVehicleFromVin(vinInput.value, { decodeVIN });
      statusEl.textContent =
        vehicle.source === 'nhtsa'
          ? `Decoded ${vehicle.vin} via NHTSA.`
          : `Could not decode ${vehicle.vin} (${vehicle.reason}) — enter specs manually.`;
      showVehicle(vehicle);
    } finally {
      decodeBtn.disabled = false;
    }
  });

  const toggleBtn = h('button', { class: 'testbed__toggle', type: 'button', text: '🧪 Test Bed', 'aria-expanded': 'false' });
  const panel = h('div', { class: 'testbed__panel', hidden: '' }, [
    h('h2', { text: 'Developer Test Bed' }),
    h('p', { class: 'view__subtitle', text: 'Load a preset or decode a VIN to preview specs and a sandbox CarMax offer.' }),
    h('h3', { text: 'Preset Vehicles' }),
    presetSelect,
    h('h3', { text: 'VIN Decoder' }),
    h('div', { class: 'testbed__vin-row' }, [vinInput, decodeBtn]),
    statusEl,
    h('h3', { text: 'Decoded Specs' }),
    specsEl,
    h('h3', { text: 'Offer Estimate' }),
    offerEl,
  ]);
  toggleBtn.addEventListener('click', () => {
    open = !open;
    panel.hidden = !open;
    toggleBtn.setAttribute('aria-expanded', String(open));
  });

  return { el: h('div', { class: 'testbed' }, [toggleBtn, panel]) };
}
