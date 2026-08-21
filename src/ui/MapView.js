import { normalizePayload, renderTopicLayer, updateTopicLayer, resolveHoverContent, getNearbyCells, latLngToCell } from '@nemzilla/spatial-core';
import { buildDealerLayerConfig, buildDartPinElement } from '../adapters/carboyzAdapter.js';
import { evaluateVehicleMarketPosition } from '../adapters/marketEvaluationAdapter.js';
import { resolveChatQuery, rankTopMatches } from '../adapters/chatFilterAdapter.js';
import { resolveLocationQuery, describeCoordinates } from '../adapters/locationAdapter.js';
import { marketVerdictBadge } from './marketBadge.js';
import { deriveVehicleCondition } from './vehicleCard.js';
import { renderChatDiscovery } from './ChatDiscovery.js';

const DEMO_STYLE_URL = 'https://demotiles.maplibre.org/style.json';
// Fallback origin (per product spec) when geolocation is unavailable or denied.
const FALLBACK_LOCATION = { lat: 34.2388, lng: -78.0145 };
const DEFAULT_ZOOM = 10;
const FOCUS_ZOOM = 13;
// Default discovery radius: ~25 miles, expressed in km for the H3 grid-disk lookup.
const NEARBY_RADIUS_KM = 40;
const NEARBY_RADIUS_MILES = 25;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const mileageFormatter = new Intl.NumberFormat('en-US');

function el(tag, className, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function requestUserLocation() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(FALLBACK_LOCATION);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(FALLBACK_LOCATION),
      { timeout: 8000 },
    );
  });
}

/** Dealers whose H3 cell falls within the nearby-cell grid disk around `origin`. */
function filterDealersNearby(dealers, origin, radiusKm) {
  const nearbyCells = getNearbyCells(origin.lat, origin.lng, radiusKm);
  return dealers.filter(
    (dealer) =>
      typeof dealer.lat === 'number' &&
      typeof dealer.lng === 'number' &&
      nearbyCells.has(latLngToCell(dealer.lat, dealer.lng)),
  );
}

function buildNormalizedDealerLayerConfig(dealers, vehicles) {
  const rawLayerConfig = buildDealerLayerConfig({ dealers, vehicles });
  return { ...rawLayerConfig, features: normalizePayload(rawLayerConfig.features) };
}

function buildVehicleCardElement(vehicle, { vehicles, dealers }) {
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';
  const priceLabel = currencyFormatter.format(vehicle.price);
  const mileageLabel = vehicle.mileage !== null ? `${mileageFormatter.format(vehicle.mileage)} mi` : 'Mileage unavailable';
  const condition = deriveVehicleCondition(vehicle);

  const evaluation = evaluateVehicleMarketPosition(vehicle, { vehicles, dealers });
  const badge = evaluation ? marketVerdictBadge(evaluation.verdict) : marketVerdictBadge(null);

  const top = el('div', 'map-drawer__vehicle-top', [
    el('h4', 'map-drawer__vehicle-title', title),
    el('span', `${badge.className} map-drawer__vehicle-badge`, badge.label),
  ]);

  const meta = el('div', 'map-drawer__vehicle-meta', [
    el('span', 'map-drawer__vehicle-price', priceLabel),
    el('span', null, mileageLabel),
    el('span', null, condition),
    vehicle.bodyStyle ? el('span', null, vehicle.bodyStyle) : null,
  ]);

  const card = el('article', 'map-drawer__vehicle-card', [top, meta]);
  card.dataset.vehicleId = vehicle.vehicleId;
  return card;
}

/** Builds the "Enter ZIP Code or City..." search modal, hidden until `open()` is called. */
function buildLocationModal({ onResolve }) {
  const inputId = 'map-location-search-input';
  const label = el('label', 'location-modal__label', 'Search by address, ZIP code, or city');
  label.htmlFor = inputId;

  const input = document.createElement('input');
  input.id = inputId;
  input.type = 'text';
  input.className = 'location-modal__input';
  input.placeholder = 'Enter an address, ZIP code, or city...';

  const errorEl = el('p', 'location-modal__error', '');
  errorEl.hidden = true;

  const cancelBtn = el('button', 'button button--secondary', 'Cancel');
  cancelBtn.type = 'button';
  const submitBtn = el('button', 'button', 'Search');
  submitBtn.type = 'submit';

  const form = document.createElement('form');
  form.className = 'location-modal';
  form.append(label, input, errorEl, el('div', 'location-modal__actions', [cancelBtn, submitBtn]));

  const modal = el('div', 'modal', [form]);
  const overlay = el('div', 'modal-overlay', [modal]);
  overlay.hidden = true;

  function close() {
    overlay.hidden = true;
    errorEl.hidden = true;
    input.value = '';
  }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value;
    submitBtn.disabled = true;
    try {
      const resolved = await resolveLocationQuery(query);
      if (!resolved) {
        errorEl.textContent = `Couldn't find "${query.trim()}". Try a 5-digit ZIP, city, or address.`;
        errorEl.hidden = false;
        return;
      }
      close();
      onResolve(resolved);
    } finally {
      submitBtn.disabled = false;
    }
  });

  return {
    element: overlay,
    open() {
      overlay.hidden = false;
      requestAnimationFrame(() => input.focus());
    },
  };
}

/**
 * Renders the interactive inventory map: a #map MapLibre GL canvas, a dealership inventory drawer,
 * and a floating conversational discovery bar. The map instance itself is created lazily on first
 * mount() so an unopened Map tab costs nothing.
 */
export function renderMapView({ onFeatureSelect } = {}) {
  if (typeof window === 'undefined' || !window.maplibregl) {
    throw new Error('MapView requires the maplibre-gl global script to be loaded before App.js');
  }
  const maplibregl = window.maplibregl;

  const mapContainer = document.createElement('div');
  mapContainer.id = 'map';
  mapContainer.className = 'map-view__canvas';

  const drawerBody = document.createElement('div');
  drawerBody.className = 'map-drawer__body';
  const drawerClose = document.createElement('button');
  drawerClose.type = 'button';
  drawerClose.className = 'map-drawer__close';
  drawerClose.textContent = 'Close';
  const drawer = document.createElement('div');
  drawer.className = 'map-drawer';
  drawer.hidden = true;
  drawer.append(drawerBody, drawerClose);
  drawerClose.addEventListener('click', () => {
    drawer.hidden = true;
  });

  const chatDiscovery = renderChatDiscovery({
    onSubmit: async (text) => {
      const query = await resolveChatQuery(text);
      const localDealers = nearbyDealers ?? dealers;
      const localDealerIds = new Set(localDealers.map((dealer) => dealer.dealerId));
      const localVehicles = vehicles.filter((vehicle) => localDealerIds.has(vehicle.dealerId));
      const matches = rankTopMatches(localVehicles, localDealers, query, { topN: 5 });
      chatDiscovery.showResults(matches, query.intentSummary);
    },
    onSelectResult: ({ vehicle, dealer }) => {
      chatDiscovery.hideResults();
      focusDealer(dealer.dealerId, vehicle.vehicleId);
    },
  });

  const locationBar = document.createElement('button');
  locationBar.type = 'button';
  locationBar.className = 'map-location-bar';
  locationBar.setAttribute('aria-haspopup', 'dialog');

  const locateBtn = document.createElement('button');
  locateBtn.type = 'button';
  locateBtn.className = 'map-locate-btn';
  locateBtn.setAttribute('aria-label', 'Locate me');
  locateBtn.textContent = '🎯';

  const locationModal = buildLocationModal({
    onResolve: (resolved) => applyUserLocation({ lat: resolved.lat, lng: resolved.lng }, resolved.label),
  });
  locationBar.addEventListener('click', () => locationModal.open());
  locateBtn.addEventListener('click', handleLocateMeClick);

  const section = document.createElement('section');
  section.className = 'view view--map';
  section.id = 'view-map';
  section.append(mapContainer, locationBar, locateBtn, locationModal.element, drawer, chatDiscovery.element);

  let map = null;
  let handle = null;
  let popup = null;
  let featuresById = new Map();
  let dealers = [];
  let vehicles = [];
  let nearbyDealers = null;
  let userLocation = null;
  let locationRequested = false;
  let locationLabel = describeCoordinates(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lng);
  updateLocationBar();

  function showDrawer(dealerFeature, { highlightVehicleId } = {}) {
    drawerBody.innerHTML = '';

    const dealerVehicles = vehicles.filter((vehicle) => vehicle.dealerId === dealerFeature.id);

    drawerBody.append(el('h3', 'map-drawer__title', dealerFeature.title));

    if (dealerVehicles.length === 0) {
      drawerBody.append(el('p', 'map-drawer__summary', 'No vehicles currently listed at this dealership.'));
    } else {
      const inventoryList = el(
        'div',
        'map-drawer__inventory',
        dealerVehicles.map((vehicle) => buildVehicleCardElement(vehicle, { vehicles, dealers })),
      );
      drawerBody.append(inventoryList);

      if (highlightVehicleId) {
        const highlighted = inventoryList.querySelector(`[data-vehicle-id="${CSS.escape(highlightVehicleId)}"]`);
        if (highlighted) {
          highlighted.classList.add('map-drawer__vehicle-card--highlight');
          highlighted.scrollIntoView({ block: 'nearest' });
        }
      }
    }

    drawer.hidden = false;
  }

  const renderOptions = {
    showH3Overlay: true,
    MarkerClass: maplibregl.Marker,
    overlay: {
      renderMarker: buildDartPinElement,
      onNodeClick: (node) => {
        showDrawer(node);
        onFeatureSelect?.(node.id, node);
      },
      onNodeHover: (node) => {
        popup?.remove();
        if (!node.coordinates) return;
        popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
          .setLngLat([node.coordinates.lng, node.coordinates.lat])
          .setHTML(resolveHoverContent(node))
          .addTo(map);
      },
      onNodeLeave: () => {
        popup?.remove();
        popup = null;
      },
      onMapBackgroundClick: () => {
        drawer.hidden = true;
        popup?.remove();
        popup = null;
      },
    },
  };

  function renderLayer() {
    const relevantDealers = nearbyDealers ?? dealers;
    const layerConfig = buildNormalizedDealerLayerConfig(relevantDealers, vehicles);
    featuresById = new Map(layerConfig.features.map((feature) => [feature.id, feature]));

    if (!handle) {
      handle = renderTopicLayer(map, layerConfig, renderOptions);
    } else {
      updateTopicLayer(map, layerConfig, handle, renderOptions);
    }
  }

  function focusDealer(dealerId, vehicleId) {
    const feature = featuresById.get(dealerId);
    if (!feature || !map) return;
    map.flyTo({ center: [feature.coordinates.lng, feature.coordinates.lat], zoom: FOCUS_ZOOM });
    showDrawer(feature, { highlightVehicleId: vehicleId });
  }

  function updateLocationBar() {
    locationBar.textContent = `📍 ${locationLabel} (${NEARBY_RADIUS_MILES} mi)`;
  }

  function applyUserLocation(location, label) {
    userLocation = location;
    locationLabel = label ?? describeCoordinates(location.lat, location.lng);
    updateLocationBar();
    nearbyDealers = filterDealersNearby(dealers, location, NEARBY_RADIUS_KM);
    map.flyTo({ center: [location.lng, location.lat], zoom: DEFAULT_ZOOM });
    if (map.isStyleLoaded()) renderLayer();
  }

  function setLocateBtnBusy(busy) {
    locateBtn.disabled = busy;
    locateBtn.textContent = busy ? '⏳' : '🎯';
  }

  function handleLocateMeClick() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      locationBar.textContent = 'Location services are not available on this device.';
      setTimeout(updateLocationBar, 3000);
      return;
    }
    if (!map) return;
    setLocateBtnBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocateBtnBusy(false);
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (map.isStyleLoaded()) {
          applyUserLocation(location);
        } else {
          map.once('load', () => applyUserLocation(location));
        }
      },
      () => {
        setLocateBtnBusy(false);
        locationBar.textContent = "Couldn't get your location. Check permissions and try again.";
        setTimeout(updateLocationBar, 3000);
      },
      { timeout: 8000 },
    );
  }

  function ensureMap() {
    if (map) return;
    map = new maplibregl.Map({
      container: mapContainer,
      style: DEMO_STYLE_URL,
      center: [FALLBACK_LOCATION.lng, FALLBACK_LOCATION.lat],
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', renderLayer);
  }

  function ensureUserLocation() {
    if (locationRequested) return;
    locationRequested = true;
    requestUserLocation().then((location) => {
      if (map.isStyleLoaded()) {
        applyUserLocation(location);
      } else {
        map.once('load', () => applyUserLocation(location));
      }
    });
  }

  return {
    section,
    mount() {
      ensureMap();
      ensureUserLocation();
      requestAnimationFrame(() => map?.resize());
    },
    update(nextDealers, nextVehicles) {
      dealers = nextDealers ?? [];
      vehicles = nextVehicles ?? [];
      if (userLocation) nearbyDealers = filterDealersNearby(dealers, userLocation, NEARBY_RADIUS_KM);
      if (map?.isStyleLoaded()) renderLayer();
    },
  };
}
