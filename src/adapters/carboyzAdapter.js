const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const mileageFormatter = new Intl.NumberFormat('en-US');

export const CARBOYZ_MAP_LAYER_ID = 'carboyz-inventory';
export const CARBOYZ_MAP_TOPIC = 'auto';
export const CARBOYZ_MAP_STYLE = { pinColor: '#3B82F6', icon: 'car' };

function buildSynopsisCardHtml({ vehicle, dealer, title }) {
  const priceLabel = currencyFormatter.format(vehicle.price);
  const mileageLabel =
    vehicle.mileage !== null ? `${mileageFormatter.format(vehicle.mileage)} mi` : 'Mileage unavailable';

  return [
    `<div class="map-synopsis">`,
    `<strong class="map-synopsis__title">${title}</strong>`,
    `<div class="map-synopsis__meta">${priceLabel} · ${mileageLabel}${vehicle.bodyStyle ? ` · ${vehicle.bodyStyle}` : ''}</div>`,
    dealer ? `<div class="map-synopsis__dealer">${dealer.name}</div>` : '',
    `</div>`,
  ].join('');
}

/**
 * Converts carboyz vehicle inventory (positioned at their dealer's location) into the raw,
 * pre-validation feature payload the @nemzilla/spatial-core ingestion pipeline expects.
 */
export function buildInventoryFeatures({ dealers = [], vehicles = [] } = {}) {
  const dealersById = new Map(dealers.map((dealer) => [dealer.dealerId, dealer]));

  return vehicles
    .map((vehicle) => {
      const dealer = dealersById.get(vehicle.dealerId);
      const lat = vehicle.lat ?? dealer?.lat ?? null;
      const lng = vehicle.lng ?? dealer?.lng ?? null;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return null;
      }

      const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';

      return {
        id: vehicle.vehicleId,
        title,
        topic: CARBOYZ_MAP_TOPIC,
        coordinates: { lat, lng },
        synopsisCardHtml: buildSynopsisCardHtml({ vehicle, dealer, title }),
        metadata: {
          dealerId: vehicle.dealerId,
          dealerName: dealer?.name ?? null,
          price: vehicle.price,
          mileage: vehicle.mileage,
          bodyStyle: vehicle.bodyStyle,
        },
      };
    })
    .filter(Boolean);
}

/** Builds the LayerConfig payload (pre-normalization) carboyz submits to the spatial-core rendering pipeline. */
export function buildCarboyzLayerConfig({ dealers = [], vehicles = [], layerId = CARBOYZ_MAP_LAYER_ID } = {}) {
  return {
    layerId,
    topic: CARBOYZ_MAP_TOPIC,
    style: CARBOYZ_MAP_STYLE,
    features: buildInventoryFeatures({ dealers, vehicles }),
  };
}

export const CARBOYZ_DEALER_LAYER_ID = 'carboyz-dealers';

function buildDealerSynopsisCardHtml({ dealer, dealerVehicles }) {
  const count = dealerVehicles.length;
  const inventoryLabel = count === 1 ? '1 vehicle in stock' : `${count} vehicles in stock`;

  if (count === 0) {
    return [
      `<div class="map-synopsis">`,
      `<strong class="map-synopsis__title">${dealer.name}</strong>`,
      `<div class="map-synopsis__meta">${inventoryLabel}</div>`,
      `</div>`,
    ].join('');
  }

  const prices = dealerVehicles.map((vehicle) => vehicle.price);
  const priceRangeLabel =
    Math.min(...prices) === Math.max(...prices)
      ? currencyFormatter.format(prices[0])
      : `${currencyFormatter.format(Math.min(...prices))} – ${currencyFormatter.format(Math.max(...prices))}`;

  return [
    `<div class="map-synopsis">`,
    `<strong class="map-synopsis__title">${dealer.name}</strong>`,
    `<div class="map-synopsis__meta">${inventoryLabel} · ${priceRangeLabel}</div>`,
    `</div>`,
  ].join('');
}

/**
 * Converts carboyz dealers into one map pin per dealership (rather than per vehicle), so a pin click
 * can open that dealer's full inventory. Dealers with no resolvable lat/lng are dropped.
 */
export function buildDealerFeatures({ dealers = [], vehicles = [] } = {}) {
  const vehiclesByDealerId = new Map();
  for (const vehicle of vehicles) {
    if (!vehiclesByDealerId.has(vehicle.dealerId)) {
      vehiclesByDealerId.set(vehicle.dealerId, []);
    }
    vehiclesByDealerId.get(vehicle.dealerId).push(vehicle);
  }

  return dealers
    .filter((dealer) => typeof dealer.lat === 'number' && typeof dealer.lng === 'number')
    .map((dealer) => {
      const dealerVehicles = vehiclesByDealerId.get(dealer.dealerId) ?? [];
      return {
        id: dealer.dealerId,
        title: dealer.name,
        topic: CARBOYZ_MAP_TOPIC,
        coordinates: { lat: dealer.lat, lng: dealer.lng },
        synopsisCardHtml: buildDealerSynopsisCardHtml({ dealer, dealerVehicles }),
        metadata: { dealerId: dealer.dealerId, vehicleCount: dealerVehicles.length },
      };
    });
}

/** Builds the dealer-pin LayerConfig (one pin per dealership) submitted to the spatial-core rendering pipeline. */
export function buildDealerLayerConfig({ dealers = [], vehicles = [], layerId = CARBOYZ_DEALER_LAYER_ID } = {}) {
  return {
    layerId,
    topic: CARBOYZ_MAP_TOPIC,
    style: CARBOYZ_MAP_STYLE,
    features: buildDealerFeatures({ dealers, vehicles }),
  };
}

/**
 * Inline SVG markup for the CarBoyZ dealership "dart" pin (a downward-pointing teardrop), colored via
 * CARBOYZ_MAP_STYLE.pinColor. Kept as a pure string builder, separate from DOM construction, so it's
 * unit-testable without a browser/DOM environment.
 */
export function buildDartPinSvgMarkup(pinColor = CARBOYZ_MAP_STYLE.pinColor) {
  return `
    <svg viewBox="0 0 24 32" width="28" height="36" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z"
        fill="${pinColor}"
        stroke="#ffffff"
        stroke-width="1.5"
      />
      <circle cx="12" cy="12" r="4.5" fill="#ffffff" />
    </svg>
  `;
}

/**
 * The CarBoyZ domain overlay's `renderMarker`: wraps the dart-pin SVG markup in a DOM element per the
 * @nemzilla/spatial-core OverlayConfig contract. Requires a browser/DOM environment (`document`) —
 * DOM construction itself is intentionally left untested, matching this codebase's existing convention
 * of keeping DOM-touching UI code thin and delegating logic to plain, testable builders (see MapView.js).
 */
export function buildDartPinElement(feature) {
  const wrapper = document.createElement('div');
  wrapper.className = 'map-dart-pin';
  wrapper.setAttribute('role', 'img');
  wrapper.setAttribute('aria-label', feature?.title ?? 'Dealer');
  wrapper.innerHTML = buildDartPinSvgMarkup();
  return wrapper;
}
