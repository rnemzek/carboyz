const NAME_TEMPLATES = [
  '{loc} Motors',
  '{loc} Truck Hub',
  'Coastal {loc} Auto',
  '{loc} Auto Exchange',
  '{loc} Motor Works',
  'Downtown {loc} Autos',
  '{loc} Auto Gallery',
];

// Reuses the make/model/bodyStyle flavor already established in seedInventory.js's seed data.
const VEHICLE_TEMPLATES = [
  { make: 'Honda', model: 'CR-V', bodyStyle: 'suv' },
  { make: 'Toyota', model: 'Camry', bodyStyle: 'sedan' },
  { make: 'Toyota', model: 'RAV4', bodyStyle: 'suv' },
  { make: 'Ford', model: 'Escape', bodyStyle: 'suv' },
  { make: 'Ford', model: 'Edge', bodyStyle: 'suv' },
  { make: 'Ford', model: 'F-150', bodyStyle: 'truck' },
  { make: 'Chevrolet', model: 'Equinox', bodyStyle: 'suv' },
  { make: 'Chevrolet', model: 'Silverado 1500', bodyStyle: 'truck' },
  { make: 'Jeep', model: 'Wrangler', bodyStyle: 'suv' },
  { make: 'Jeep', model: 'Renegade', bodyStyle: 'suv' },
  { make: 'Nissan', model: 'Altima', bodyStyle: 'sedan' },
  { make: 'Subaru', model: 'Outback', bodyStyle: 'suv' },
  { make: 'Mazda', model: 'CX-5', bodyStyle: 'suv' },
  { make: 'Hyundai', model: 'Tucson', bodyStyle: 'suv' },
  { make: 'Kia', model: 'Sportage', bodyStyle: 'suv' },
  { make: 'Volkswagen', model: 'Jetta', bodyStyle: 'sedan' },
];

const MIN_PRICE = 15000;
const MAX_PRICE = 45000;
const MIN_MILEAGE = 5000;
const MAX_MILEAGE = 90000;
const MIN_YEAR = 2018;
const MAX_YEAR = 2023;
// Roughly 0.15deg radius: uniform offset in [-0.15, 0.15] per axis.
const SCATTER_DEGREES = 0.3;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'region';
}

/** Derives a clean short place name from a (possibly verbose) geocoder label, e.g. "Miami, Miami-Dade County, Florida" -> "Miami". */
function shortLocationName(locationLabel) {
  const trimmed = (locationLabel ?? '').trim();
  if (!trimmed) return 'Local';
  return trimmed.split(',')[0].trim() || 'Local';
}

function randomInRange(random, min, max) {
  return min + random() * (max - min);
}

function randomIntInRange(random, min, max) {
  return Math.round(randomInRange(random, min, max));
}

function buildDealerName(shortName, index) {
  const template = NAME_TEMPLATES[index % NAME_TEMPLATES.length];
  return template.replace('{loc}', shortName);
}

/**
 * Procedurally generates a regional cluster of dealers (and 2-5 vehicles each) scattered around a
 * center point, for filling in map coverage when no real dealer data exists nearby. Plain objects
 * (not Dealer/Vehicle class instances) — the map rendering pipeline (buildInventoryFeatures,
 * evaluateVehicleMarketPosition, buildVehicleCardElement) is duck-typed and needs no tenantId, so
 * this stays decoupled from tenant-scoped inventory ownership (App.js/IngestService) entirely.
 *
 * `random` is injectable (defaults to Math.random) for deterministic tests, matching this codebase's
 * existing dependency-injection convention (fetchImpl, apiKey, etc.).
 */
export function generateRegionalDealers(centerLat, centerLng, locationLabel, count = 10, { random = Math.random } = {}) {
  const shortName = shortLocationName(locationLabel);
  const regionSlug = slugify(shortName);

  const dealers = [];
  const vehicles = [];

  for (let i = 0; i < count; i += 1) {
    const dealerId = `generated-${regionSlug}-${i}`;
    const lat = centerLat + (random() - 0.5) * SCATTER_DEGREES;
    const lng = centerLng + (random() - 0.5) * SCATTER_DEGREES;
    dealers.push({ dealerId, name: buildDealerName(shortName, i), lat, lng });

    const vehicleCount = randomIntInRange(random, 2, 5);
    for (let v = 0; v < vehicleCount; v += 1) {
      const template = VEHICLE_TEMPLATES[Math.floor(random() * VEHICLE_TEMPLATES.length)];
      vehicles.push({
        vehicleId: `${dealerId}-v${v}`,
        dealerId,
        make: template.make,
        model: template.model,
        bodyStyle: template.bodyStyle,
        year: randomIntInRange(random, MIN_YEAR, MAX_YEAR),
        price: randomIntInRange(random, MIN_PRICE, MAX_PRICE),
        mileage: randomIntInRange(random, MIN_MILEAGE, MAX_MILEAGE),
      });
    }
  }

  return { dealers, vehicles };
}
