import { resolveMapStyleUrl } from './MapView.js';
import { DEFAULT_DEALERSHIP_COORDINATES } from '../config/tenantConfig.js';
import {
  buildHqAnchorFeature,
  buildRangeRingFeatures,
  buildLeadOriginFeatureCollection,
  classifyLeadPinStatus,
  RADAR_STYLE,
} from '../services/radarLayerBuilder.js';

const DEFAULT_ZOOM = 10;
const PULSE_INTERVAL_MS = 650;
const ACTIVE_RADIUS_MILES = 25;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function el(tag, className, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function describeVehicle(submission) {
  return [submission.year, submission.make, submission.model].filter(Boolean).join(' ') || 'Vehicle';
}

/**
 * Renders the Acquisition Radar: a MapLibre canvas showing the dealership HQ anchor, 10/25/50-mile
 * range rings, and status-pinned lead origins, plus an Unlocated Leads dock and a territorial
 * metric pill (UOW-52). Replaces the inventory-focused MapView.js on the "map" tab — same
 * `{ section, mount, update }` contract, so App.js drops it in with no other changes.
 */
export function renderRadarMapView({ onOpenLeadInbox } = {}) {
  if (typeof window === 'undefined' || !window.maplibregl) {
    throw new Error('RadarMapView requires the maplibre-gl global script to be loaded before App.js');
  }
  const maplibregl = window.maplibregl;

  const mapContainer = document.createElement('div');
  mapContainer.id = 'radar-map';
  mapContainer.className = 'map-view__canvas';

  const metricPill = el('div', 'radar-metric-pill');

  const drawerBody = el('div', 'map-drawer__body');
  const drawerClose = document.createElement('button');
  drawerClose.type = 'button';
  drawerClose.className = 'map-drawer__close';
  drawerClose.textContent = 'Close';
  const drawer = el('div', 'map-drawer', [drawerBody, drawerClose]);
  drawer.hidden = true;
  drawerClose.addEventListener('click', () => {
    drawer.hidden = true;
  });

  function showInspectionDrawer(properties) {
    drawerBody.replaceChildren();
    const badge = RADAR_STYLE.pin[properties.pinStatus] ?? RADAR_STYLE.pin.PENDING;

    const statusBadge = el('span', 'radar-pin-badge', badge.label);
    statusBadge.style.setProperty('--radar-pin-color', badge.color);

    // Native Element.append() (unlike this file's own el()/h() helpers) stringifies a null/
    // undefined argument into a literal "null" text node rather than skipping it — filter first.
    drawerBody.append(
      ...[
        el('h3', 'map-drawer__title', properties.vehicle),
        statusBadge,
        el(
          'p',
          'map-drawer__summary',
          `Competitor: ${properties.competitor ?? 'Unknown'} · Offer: ${currencyFormatter.format(properties.offerAmount ?? 0)}`,
        ),
        properties.finalCounterOffer != null
          ? el('p', 'map-drawer__summary', `Counter offer: ${currencyFormatter.format(properties.finalCounterOffer)}`)
          : null,
        properties.distanceFromHqMiles != null
          ? el('p', 'map-drawer__summary', `${properties.distanceFromHqMiles} mi from HQ`)
          : null,
      ].filter(Boolean),
    );

    const openLeadBtn = document.createElement('button');
    openLeadBtn.type = 'button';
    openLeadBtn.className = 'button button--secondary';
    openLeadBtn.textContent = 'Open in Lead Inbox';
    openLeadBtn.addEventListener('click', () => onOpenLeadInbox?.(properties.submissionId));
    drawerBody.append(openLeadBtn);

    drawer.hidden = false;
  }

  function propertiesFromSubmission(submission) {
    return {
      submissionId: submission.id,
      vehicle: describeVehicle(submission),
      competitor: submission.competitor,
      offerAmount: submission.competitorOfferAmount,
      finalCounterOffer: submission.finalCounterOffer,
      pinStatus: classifyLeadPinStatus(submission),
      distanceFromHqMiles: null,
    };
  }

  // Unlocated Leads dock — a collapsible tray for submissions with no resolvable coordinates.
  let unlocatedExpanded = true;
  const unlocatedList = el('div', 'radar-unlocated-dock__list');
  const unlocatedToggle = document.createElement('button');
  unlocatedToggle.type = 'button';
  unlocatedToggle.className = 'radar-unlocated-dock__toggle';
  unlocatedToggle.setAttribute('aria-expanded', 'true');
  unlocatedToggle.addEventListener('click', () => {
    unlocatedExpanded = !unlocatedExpanded;
    renderUnlocatedDock(lastUnlocated);
  });
  const unlocatedDock = el('div', 'radar-unlocated-dock', [unlocatedToggle, unlocatedList]);

  let lastUnlocated = [];
  function renderUnlocatedDock(unlocatedSubmissions) {
    lastUnlocated = unlocatedSubmissions;
    unlocatedToggle.textContent = `Unlocated Leads (${unlocatedSubmissions.length}) ${unlocatedExpanded ? '▾' : '▸'}`;
    unlocatedToggle.setAttribute('aria-expanded', String(unlocatedExpanded));
    unlocatedList.hidden = !unlocatedExpanded;
    unlocatedList.replaceChildren();

    if (unlocatedSubmissions.length === 0) {
      unlocatedList.append(el('p', 'radar-unlocated-dock__empty', 'All leads are mapped.'));
      return;
    }

    unlocatedSubmissions.forEach((submission) => {
      const badge = RADAR_STYLE.pin[classifyLeadPinStatus(submission)];
      const statusBadge = el('span', 'radar-pin-badge', badge.label);
      statusBadge.style.setProperty('--radar-pin-color', badge.color);

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'radar-unlocated-dock__item';
      item.append(
        el('span', 'radar-unlocated-dock__item-title', describeVehicle(submission)),
        statusBadge,
        el('span', 'radar-unlocated-dock__item-offer', currencyFormatter.format(submission.competitorOfferAmount ?? 0)),
      );
      item.addEventListener('click', () => showInspectionDrawer(propertiesFromSubmission(submission)));
      unlocatedList.append(item);
    });
  }

  const section = document.createElement('section');
  section.className = 'view view--map';
  section.id = 'view-radar';
  section.append(mapContainer, metricPill, unlocatedDock, drawer);

  let map = null;
  let styleReady = false;
  let submissions = [];
  let tenantConfig = null;
  let pulseHandle = null;
  let pulsePhase = false;

  function hqCoordinates() {
    return tenantConfig?.dealershipCoordinates ?? DEFAULT_DEALERSHIP_COORDINATES;
  }

  function stopPulse() {
    if (pulseHandle) {
      clearInterval(pulseHandle);
      pulseHandle = null;
    }
  }

  function startPulse() {
    stopPulse();
    pulseHandle = setInterval(() => {
      pulsePhase = !pulsePhase;
      if (map?.getLayer('radar-lead-origin-pending-halo')) {
        map.setPaintProperty('radar-lead-origin-pending-halo', 'circle-opacity', pulsePhase ? 0.6 : 0.2);
        map.setPaintProperty('radar-lead-origin-pending-halo', 'circle-radius', pulsePhase ? 16 : 12);
      }
    }, PULSE_INTERVAL_MS);
  }

  function initLayers() {
    const emptyCollection = { type: 'FeatureCollection', features: [] };

    map.addSource('radar-range-rings', { type: 'geojson', data: emptyCollection });
    map.addLayer({
      id: 'radar-range-rings-fill',
      type: 'fill',
      source: 'radar-range-rings',
      paint: { 'fill-color': RADAR_STYLE.ring.fillColor },
    });
    map.addLayer({
      id: 'radar-range-rings-line',
      type: 'line',
      source: 'radar-range-rings',
      paint: { 'line-color': RADAR_STYLE.ring.strokeColor, 'line-width': 1.5 },
    });
    map.addLayer({
      id: 'radar-range-rings-label',
      type: 'symbol',
      source: 'radar-range-rings',
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-offset': [0, -0.6],
      },
      paint: { 'text-color': RADAR_STYLE.ring.labelColor },
    });

    map.addSource('radar-hq-anchor', { type: 'geojson', data: emptyCollection });
    map.addLayer({
      id: 'radar-hq-anchor-pin',
      type: 'circle',
      source: 'radar-hq-anchor',
      paint: {
        'circle-radius': 9,
        'circle-color': RADAR_STYLE.hqAnchor.color,
        'circle-stroke-color': RADAR_STYLE.hqAnchor.strokeColor,
        'circle-stroke-width': 2,
      },
    });
    map.addLayer({
      id: 'radar-hq-anchor-label',
      type: 'symbol',
      source: 'radar-hq-anchor',
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 12,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
      },
      paint: { 'text-color': RADAR_STYLE.hqAnchor.color },
    });

    map.addSource('radar-lead-origins', { type: 'geojson', data: emptyCollection });
    map.addLayer({
      id: 'radar-lead-origin-pins',
      type: 'circle',
      source: 'radar-lead-origins',
      paint: {
        'circle-radius': 8,
        'circle-color': [
          'match',
          ['get', 'pinStatus'],
          'PENDING', RADAR_STYLE.pin.PENDING.color,
          'ACTIVE', RADAR_STYLE.pin.ACTIVE.color,
          'CLOSED', RADAR_STYLE.pin.CLOSED.color,
          RADAR_STYLE.pin.PENDING.color,
        ],
        'circle-stroke-color': '#0f172a',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.95,
      },
    });
    // Pulsing halo rendered beneath the solid pin layer, limited to PENDING leads.
    map.addLayer(
      {
        id: 'radar-lead-origin-pending-halo',
        type: 'circle',
        source: 'radar-lead-origins',
        filter: ['==', ['get', 'pinStatus'], 'PENDING'],
        paint: {
          'circle-radius': 14,
          'circle-color': RADAR_STYLE.pin.PENDING.color,
          'circle-opacity': 0.35,
        },
      },
      'radar-lead-origin-pins',
    );

    map.on('click', 'radar-lead-origin-pins', (event) => {
      const feature = event.features?.[0];
      if (feature) showInspectionDrawer(feature.properties);
    });
    map.on('mouseenter', 'radar-lead-origin-pins', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'radar-lead-origin-pins', () => {
      map.getCanvas().style.cursor = '';
    });
    // Clicking empty map background dismisses the drawer, same as the old MapView.js.
    map.on('click', (event) => {
      const hitPin = map.queryRenderedFeatures(event.point, { layers: ['radar-lead-origin-pins'] });
      if (hitPin.length === 0) drawer.hidden = true;
    });

    startPulse();
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', stopPulse);
    }
  }

  function renderMetricPill(leadFeatures, unlocatedSubmissions) {
    const activeWithin25mi = leadFeatures.filter(
      (feature) =>
        feature.properties.pinStatus !== 'CLOSED' &&
        (feature.properties.distanceFromHqMiles ?? Infinity) <= ACTIVE_RADIUS_MILES,
    ).length;
    const awaitingReview = submissions.filter(
      (submission) => classifyLeadPinStatus(submission) === 'PENDING',
    ).length;
    metricPill.textContent = `Active Leads within ${ACTIVE_RADIUS_MILES}mi: ${activeWithin25mi} | Awaiting Review: ${awaitingReview} | Unlocated: ${unlocatedSubmissions.length}`;
  }

  function renderLayers() {
    // Not map.isStyleLoaded(): that also waits on the GeoJSON sources initLayers() just added,
    // which isn't true synchronously the moment 'load' fires — it would make this first call,
    // from inside the 'load' handler itself, a silent no-op.
    if (!map || !styleReady) return;
    const hq = hqCoordinates();
    const hqFeature = buildHqAnchorFeature({ name: tenantConfig?.name, dealershipCoordinates: hq });
    const ringFeatures = buildRangeRingFeatures(hq);
    const { featureCollection, unlocated } = buildLeadOriginFeatureCollection(submissions, hq);

    map.getSource('radar-hq-anchor')?.setData({ type: 'FeatureCollection', features: [hqFeature] });
    map.getSource('radar-range-rings')?.setData({ type: 'FeatureCollection', features: ringFeatures });
    map.getSource('radar-lead-origins')?.setData(featureCollection);

    renderUnlocatedDock(unlocated);
    renderMetricPill(featureCollection.features, unlocated);
  }

  function ensureMap() {
    if (map) return;
    const hq = hqCoordinates();
    map = new maplibregl.Map({
      container: mapContainer,
      style: resolveMapStyleUrl(),
      center: [hq.lng, hq.lat],
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => {
      initLayers();
      styleReady = true;
      renderLayers();
    });
  }

  return {
    section,
    mount() {
      ensureMap();
      requestAnimationFrame(() => map?.resize());
    },
    update(nextSubmissions, nextTenantConfig) {
      submissions = nextSubmissions ?? [];
      tenantConfig = nextTenantConfig ?? tenantConfig;
      renderLayers();
    },
  };
}
