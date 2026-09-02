import { Dealer } from '../models/Dealer.js';
import { TenantRegistry, CARBOYZ_TENANT_ID, CARBOYZ_FLAGSHIP_PRESET } from '../config/TenantRegistry.js';
import { writeTenantIdToStorage } from '../config/tenantResolution.js';
import { TelemetryService } from '../services/TelemetryService.js';
import { SearchService } from '../services/SearchService.js';
import { IngestService } from '../services/IngestService.js';
import { HapticsService } from '../services/HapticsService.js';
import { ShareService } from '../services/ShareService.js';
import { DiscoveryService } from '../services/DiscoveryService.js';
import { SubmissionService } from '../services/SubmissionService.js';
import { SpreadConfigService } from '../services/SpreadConfigService.js';
import { DispatchService } from '../services/DispatchService.js';
import { SessionStashService } from '../services/SessionStashService.js';
import { AnalyticsService } from '../services/AnalyticsService.js';
import { SellerSubmissionController } from './SellerSubmissionController.js';
import { renderSellerSubmissionView } from './SellerSubmissionView.js';
import { LeadInboxController } from './LeadInboxController.js';
import { renderLeadInboxView } from './LeadInboxView.js';
import { SpreadConfigController } from './SpreadConfigController.js';
import { renderSpreadConfigView } from './SpreadConfigView.js';
import { AnalyticsController } from './AnalyticsController.js';
import { renderAnalyticsView } from './AnalyticsView.js';
import { renderTestHarnessView, parsePrefillFromSearch } from './TestHarnessView.js';
import { TenantConfigService } from '../services/TenantConfigService.js';
import { SyncAdapter } from '../services/SyncAdapter.js';
import { renderBottomNavView } from './BottomNavView.js';
import { renderPwaInstallPromptView } from './PwaInstallPromptView.js';
import {
  SEED_ANCHOR,
  CARBOYZ_HQ_DEALER_ID,
  VENDOR_FEEDS as CARBOYZ_VENDOR_FEEDS,
  seedDirectInventory,
  LOCAL_DEALERS,
  seedLocalDealers,
} from '../utils/seedInventory.js';
import { getBrandInitials } from './branding.js';
import { discoveryStageLabel } from './discoveryProgress.js';
import { DealerStudioController } from './DealerStudioController.js';
import { BuyerSearchController } from './BuyerSearchController.js';
import { renderMapView } from './MapView.js';

const BODY_STYLES = ['sedan', 'suv', 'truck', 'coupe', 'hatchback', 'van'];

function createDistroNotifier() {
  return {
    notify(notification) {
      console.info(`[${notification.target}] ${notification.title}`, notification.body);
      if (typeof Notification !== 'function') {
        return;
      }
      if (Notification.permission === 'granted') {
        new Notification(notification.title, { body: notification.body });
      }
    },
  };
}

const TENANT_PRESETS = [
  {
    ...CARBOYZ_FLAGSHIP_PRESET,
    dealers: [
      { dealerId: CARBOYZ_HQ_DEALER_ID, name: 'CarBoyZ Motors HQ', lat: SEED_ANCHOR.lat, lng: SEED_ANCHOR.lng },
      ...LOCAL_DEALERS,
    ],
  },
  {
    tenantId: 'summit-auto',
    name: 'Summit Auto Group',
    tagline: 'Mountain-tested deals, valley-low prices.',
    themeColors: { primary: '#b3541e', secondary: '#2b2118' },
    contact: { phone: '(555) 040-8080', email: 'sales@summitauto.example' },
    dealers: [
      { dealerId: 'summit-central', name: 'Summit Central', lat: 39.74, lng: -104.99 },
      { dealerId: 'summit-foothills', name: 'Summit Foothills', lat: 39.65, lng: -105.15 },
    ],
  },
  {
    tenantId: 'harbor-motors',
    name: 'Harbor Motors Collective',
    tagline: 'Coastal rides, honest prices.',
    themeColors: { primary: '#0a7f6b', secondary: '#0e2430' },
    contact: { phone: '(555) 070-3030', email: 'info@harbormotors.example' },
    dealers: [
      { dealerId: 'harbor-pier', name: 'Harbor Pier Autos', lat: 42.3601, lng: -71.0589 },
      { dealerId: 'harbor-bay', name: 'Harbor Bay Certified', lat: 42.35, lng: -71.08 },
    ],
  },
];

const DEFAULT_TENANT_ID = TENANT_PRESETS[0].tenantId;

const VENDOR_FEEDS_BY_TENANT = {
  [CARBOYZ_TENANT_ID]: CARBOYZ_VENDOR_FEEDS,
  'summit-auto': [
    {
      dealer: {
        dealer_id: 'vendor-alpine',
        dealer_name: 'Alpine Pre-Owned (Vendor)',
        latitude: 39.72,
        longitude: -105.02,
      },
      vehicles: [
        { id: 'va-3001', dealer_id: 'vendor-alpine', make: 'Subaru', model: 'Outback', year: 2022, asking_price: 28500, odometer: 15000, body_type: 'suv' },
        { id: 'va-3002', dealer_id: 'vendor-alpine', make: 'Subaru', model: 'Outback', year: 2022, asking_price: 25500, odometer: 27000, body_type: 'suv' },
      ],
    },
  ],
  'harbor-motors': [
    {
      dealer: {
        dealer_id: 'vendor-seaside',
        dealer_name: 'Seaside Import Exchange (Vendor)',
        latitude: 42.34,
        longitude: -71.06,
      },
      vehicles: [
        { id: 'vs-4001', dealer_id: 'vendor-seaside', make: 'Mazda', model: 'CX-5', year: 2023, asking_price: 29500, odometer: 5000, body_type: 'suv' },
        { id: 'vs-4002', dealer_id: 'vendor-seaside', make: 'Mazda', model: 'CX-5', year: 2023, asking_price: 26500, odometer: 18000, body_type: 'suv' },
      ],
    },
  ],
};

function buildTenantRegistry() {
  return new TenantRegistry(TENANT_PRESETS.map(({ dealers, ...preset }) => preset));
}

function buildDealersByTenant() {
  return new Map(
    TENANT_PRESETS.map((preset) => [
      preset.tenantId,
      preset.dealers.map((dealer) => new Dealer({ tenantId: preset.tenantId, ...dealer })),
    ]),
  );
}

export function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (key === 'class') {
      node.className = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) {
      continue;
    }
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function renderBrandLogo(tenantConfig) {
  const fallback = h('span', {
    class: 'app__logo app__logo--fallback',
    text: getBrandInitials(tenantConfig.name),
  });

  if (!tenantConfig.logoUrl) {
    return fallback;
  }

  const img = h('img', {
    class: 'app__logo',
    src: tenantConfig.logoUrl,
    alt: `${tenantConfig.name} logo`,
  });
  img.addEventListener('error', () => img.replaceWith(fallback), { once: true });
  return img;
}

function renderHeader(tenantConfig) {
  const titleGroup = h('div', { class: 'app__title-group' }, [
    h('h1', { class: 'app__title', text: tenantConfig.name }),
    tenantConfig.tagline ? h('p', { class: 'app__tagline', text: tenantConfig.tagline }) : null,
  ]);
  return h('header', { class: 'app__header' }, [renderBrandLogo(tenantConfig), titleGroup]);
}

function renderOfflineBanner(isOffline) {
  if (!isOffline) {
    return null;
  }
  return h('div', {
    class: 'offline-banner',
    role: 'status',
    'aria-live': 'polite',
    text: "You're offline — submissions are saved on this device and will sync automatically once you're back online.",
  });
}

function renderBrandSwitcher(presets, activeTenantId, onSwitch) {
  const select = h(
    'select',
    { 'aria-label': 'Switch dealer brand' },
    presets.map((preset) => h('option', { value: preset.tenantId, text: preset.name })),
  );
  select.value = activeTenantId;
  select.addEventListener('change', () => onSwitch(select.value));

  return h('div', { class: 'brand-switcher' }, [h('label', { text: 'Dealer Brand' }), select]);
}

function renderTabs(activeTab, onSelect) {
  const sellBtn = h('button', {
    class: 'tabs__button',
    type: 'button',
    role: 'tab',
    'aria-selected': String(activeTab === 'sell'),
    text: 'Sell Your Car',
    onClick: () => onSelect('sell'),
  });
  const dealerBtn = h('button', {
    class: 'tabs__button',
    type: 'button',
    role: 'tab',
    'aria-selected': String(activeTab === 'dealer'),
    text: 'Dealer Studio',
    onClick: () => onSelect('dealer'),
  });
  const buyerBtn = h('button', {
    class: 'tabs__button',
    type: 'button',
    role: 'tab',
    'aria-selected': String(activeTab === 'buyer'),
    text: 'Buyer Search',
    onClick: () => onSelect('buyer'),
  });
  const mapBtn = h('button', {
    class: 'tabs__button',
    type: 'button',
    role: 'tab',
    'aria-selected': String(activeTab === 'map'),
    text: 'Map',
    onClick: () => onSelect('map'),
  });
  const leadsBtn = h('button', {
    class: 'tabs__button',
    type: 'button',
    role: 'tab',
    'aria-selected': String(activeTab === 'leads'),
    text: 'Lead Inbox',
    onClick: () => onSelect('leads'),
  });
  const adminBtn = h('button', {
    class: 'tabs__button',
    type: 'button',
    role: 'tab',
    'aria-selected': String(activeTab === 'admin'),
    text: 'Admin',
    onClick: () => onSelect('admin'),
  });
  const analyticsBtn = h('button', {
    class: 'tabs__button',
    type: 'button',
    role: 'tab',
    'aria-selected': String(activeTab === 'analytics'),
    text: 'Analytics',
    onClick: () => onSelect('analytics'),
  });
  const harnessBtn = h('button', {
    class: 'tabs__button',
    type: 'button',
    role: 'tab',
    'aria-selected': String(activeTab === 'harness'),
    text: 'Test Harness',
    onClick: () => onSelect('harness'),
  });
  const nav = h('nav', { class: 'tabs', role: 'tablist' }, [
    sellBtn,
    dealerBtn,
    buyerBtn,
    mapBtn,
    leadsBtn,
    adminBtn,
    analyticsBtn,
    harnessBtn,
  ]);
  return { nav, sellBtn, dealerBtn, buyerBtn, mapBtn, leadsBtn, adminBtn, analyticsBtn, harnessBtn };
}

function renderVehicleCard(card, { onShare } = {}) {
  const top = h('div', { class: 'card__top' }, [h('h3', { class: 'card__title', text: card.title })]);
  if (card.badge) {
    top.appendChild(h('span', { class: card.badge.className, text: card.badge.label }));
  }

  const meta = h('div', { class: 'card__meta' }, [
    h('span', { class: 'card__price', text: card.priceLabel }),
    h('span', { text: card.mileageLabel }),
    card.distanceLabel ? h('span', { text: card.distanceLabel }) : null,
    card.bodyStyle ? h('span', { text: card.bodyStyle }) : null,
  ]);

  const children = [top, meta];

  if (onShare) {
    const shareBtn = h('button', {
      class: 'button button--secondary',
      type: 'button',
      text: 'Share',
    });
    shareBtn.addEventListener('click', async () => {
      shareBtn.disabled = true;
      const result = await onShare(card);
      shareBtn.disabled = false;
      shareBtn.textContent = result?.shared ? 'Shared!' : 'Share';
    });
    children.push(h('div', { class: 'card__actions' }, [shareBtn]));
  }

  return h('article', { class: 'card' }, children);
}

function renderProgressModal() {
  const stageEl = h('h3', { class: 'modal__stage', text: 'Starting scan...' });
  const messageEl = h('p', { class: 'modal__message', text: '' });
  const overlay = h('div', { class: 'modal-overlay' }, [
    h('div', { class: 'modal', role: 'status', 'aria-live': 'polite' }, [stageEl, messageEl]),
  ]);

  function setStage(event) {
    stageEl.textContent = event.stage === 'ERROR' ? 'Scan Failed' : discoveryStageLabel(event.stage);
    messageEl.textContent = event.message ?? '';
  }

  return { overlay, setStage };
}

function renderDealerStudioView(dealerController, dealers, onShare, brandSwitcher) {
  const dealerSelect = h(
    'select',
    { name: 'dealerId', required: '' },
    dealers.map((dealer) => h('option', { value: dealer.dealerId, text: dealer.name })),
  );
  const makeInput = h('input', { name: 'make', placeholder: 'Make', required: '' });
  const modelInput = h('input', { name: 'model', placeholder: 'Model', required: '' });
  const yearInput = h('input', { name: 'year', type: 'number', placeholder: 'Year', required: '' });
  const priceInput = h('input', { name: 'price', type: 'number', placeholder: 'Price', min: '0', required: '' });
  const mileageInput = h('input', { name: 'mileage', type: 'number', placeholder: 'Mileage', min: '0' });
  const bodyStyleSelect = h(
    'select',
    { name: 'bodyStyle' },
    BODY_STYLES.map((style) => h('option', { value: style, text: style })),
  );

  priceInput.addEventListener('change', () => dealerController.notifyPriceChange());

  const form = h('form', { class: 'form' }, [
    h('div', { class: 'form__row' }, [h('label', { text: 'Dealer' }), dealerSelect]),
    h('div', { class: 'form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Make' }), makeInput]),
      h('div', {}, [h('label', { text: 'Model' }), modelInput]),
    ]),
    h('div', { class: 'form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Year' }), yearInput]),
      h('div', {}, [h('label', { text: 'Body Style' }), bodyStyleSelect]),
    ]),
    h('div', { class: 'form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Price ($)' }), priceInput]),
      h('div', {}, [h('label', { text: 'Mileage' }), mileageInput]),
    ]),
    h('button', { class: 'button', type: 'submit', text: 'Add to Inventory' }),
  ]);

  const list = h('div', { class: 'card-list' });

  function renderInventory() {
    list.replaceChildren();
    const cards = dealerController.buildInventoryViewModels();
    if (cards.length === 0) {
      list.appendChild(
        h('p', { class: 'empty-state', text: 'No vehicles in inventory yet. Add your first vehicle above.' }),
      );
      return;
    }
    cards.forEach((card) => list.appendChild(renderVehicleCard(card, { onShare })));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    dealerController.submitIntake({
      dealerId: data.get('dealerId'),
      make: data.get('make'),
      model: data.get('model'),
      year: Number(data.get('year')),
      price: Number(data.get('price')),
      mileage: data.get('mileage') ? Number(data.get('mileage')) : null,
      bodyStyle: data.get('bodyStyle'),
    });
    form.reset();
    renderInventory();
  });

  renderInventory();

  return h('section', { class: 'view', id: 'view-dealer' }, [
    brandSwitcher,
    form,
    h('h2', { text: 'Inventory' }),
    list,
  ]);
}

function renderBuyerSearchView(buyerController, dealers, getSearchableVehicles, tenantId, onScan) {
  const originSelect = h('select', { name: 'originDealerId' }, [
    h('option', { value: '', text: 'Any location' }),
    ...dealers.map((dealer) => h('option', { value: dealer.dealerId, text: dealer.name })),
  ]);
  const maxPriceInput = h('input', { name: 'maxPrice', type: 'number', placeholder: 'Max Price', min: '0' });
  const maxMileageInput = h('input', { name: 'maxMileage', type: 'number', placeholder: 'Max Mileage', min: '0' });
  const radiusInput = h('input', { name: 'radiusMiles', type: 'number', placeholder: 'Radius (mi)', min: '0' });
  const bodyStyleSelect = h('select', { name: 'bodyStyle' }, [
    h('option', { value: '', text: 'Any body style' }),
    ...BODY_STYLES.map((style) => h('option', { value: style, text: style })),
  ]);
  const sortSelect = h(
    'select',
    { name: 'sortBy' },
    [
      ['', 'Best Match'],
      ['price_asc', 'Price: Low to High'],
      ['mileage_asc', 'Mileage: Low to High'],
      ['distance_asc', 'Distance: Nearest'],
      ['best_value', 'Best Value'],
    ].map(([value, label]) => h('option', { value, text: label })),
  );

  const scanBtn = h('button', {
    class: 'button button--secondary',
    type: 'button',
    text: 'Scan 50-mile Radius',
  });
  scanBtn.addEventListener('click', async () => {
    const { overlay, setStage } = renderProgressModal();
    document.body.appendChild(overlay);
    scanBtn.disabled = true;
    scanBtn.textContent = 'Scanning...';
    try {
      await onScan(originSelect.value, (event) => setStage(event));
    } catch (error) {
      setStage({ stage: 'ERROR', message: error.message });
      await new Promise((resolve) => setTimeout(resolve, 1200));
    } finally {
      overlay.remove();
      scanBtn.disabled = false;
      scanBtn.textContent = 'Scan 50-mile Radius';
    }
  });

  const form = h('form', { class: 'form' }, [
    h('div', { class: 'form__row' }, [h('label', { text: 'Search Near' }), originSelect]),
    h('div', { class: 'form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Max Price ($)' }), maxPriceInput]),
      h('div', {}, [h('label', { text: 'Max Mileage' }), maxMileageInput]),
    ]),
    h('div', { class: 'form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Radius (mi)' }), radiusInput]),
      h('div', {}, [h('label', { text: 'Body Style' }), bodyStyleSelect]),
    ]),
    h('div', { class: 'form__row' }, [h('label', { text: 'Sort By' }), sortSelect]),
    h('div', { class: 'form__row form__row--split' }, [
      h('button', { class: 'button', type: 'submit', text: 'Search' }),
      scanBtn,
    ]),
  ]);

  const results = h('div', { class: 'card-list' });

  function runSearch() {
    const data = new FormData(form);
    const criteria = { tenantId };

    const maxPrice = data.get('maxPrice');
    if (maxPrice) criteria.maxPrice = Number(maxPrice);
    const maxMileage = data.get('maxMileage');
    if (maxMileage) criteria.maxMileage = Number(maxMileage);
    const bodyStyle = data.get('bodyStyle');
    if (bodyStyle) criteria.bodyStyle = bodyStyle;

    const originDealerId = data.get('originDealerId');
    const radiusMiles = data.get('radiusMiles');
    if (originDealerId) criteria.originDealerId = originDealerId;
    if (radiusMiles) criteria.radiusMiles = Number(radiusMiles);

    const sortBy = data.get('sortBy');
    if (sortBy) {
      criteria.sortBy = sortBy;
    } else if (originDealerId) {
      criteria.sortBy = 'distance_asc';
    }

    results.replaceChildren();
    let cards;
    try {
      cards = buyerController.runSearch(getSearchableVehicles(), criteria);
    } catch (error) {
      results.appendChild(h('p', { class: 'empty-state', text: error.message }));
      return;
    }

    if (cards.length === 0) {
      results.appendChild(h('p', { class: 'empty-state', text: 'No vehicles match your search yet.' }));
      return;
    }

    cards.forEach((card) =>
      results.appendChild(renderVehicleCard(card, { onShare: (c) => buyerController.shareVehicle(c) })),
    );
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearch();
  });

  runSearch();

  return h('section', { class: 'view', id: 'view-buyer', hidden: '' }, [
    form,
    h('h2', { text: 'Results' }),
    results,
  ]);
}

export function mountApp(root) {
  const registry = buildTenantRegistry();
  const dealersByTenant = buildDealersByTenant();
  const hapticsService = new HapticsService();
  const shareService = new ShareService();
  const tenantConfigService = new TenantConfigService();
  tenantConfigService.registerServiceWorker();
  const tenantStateByTenantId = new Map();
  const mapView = renderMapView();

  let activeTenantConfig = registry.resolveTenant({
    search: window.location.search,
    storage: window.localStorage,
    defaultTenantId: DEFAULT_TENANT_ID,
  });
  let pendingPrefill = parsePrefillFromSearch(window.location.search);
  let activeTab = 'sell';
  let isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  function flushPendingSync(tenantId) {
    const state = tenantStateByTenantId.get(tenantId);
    if (!state?.syncAdapter) {
      return;
    }
    state.submissionService.flushPendingSync((submission) => state.syncAdapter.submitSubmissionCreated(submission));
  }

  window.addEventListener('online', () => {
    isOffline = false;
    tenantStateByTenantId.forEach((_, tenantId) => flushPendingSync(tenantId));
    render();
  });
  window.addEventListener('offline', () => {
    isOffline = true;
    render();
  });

  function getTenantState(tenantId) {
    if (!tenantStateByTenantId.has(tenantId)) {
      const dealers = dealersByTenant.get(tenantId) ?? [];
      const telemetryService = new TelemetryService({ dealers });
      const ingestService = new IngestService({ telemetryService, tenantId });
      const searchService = new SearchService({ dealers });
      const submissionService = new SubmissionService({ tenantId, storage: window.localStorage });
      const spreadConfigService = new SpreadConfigService({ tenantId, storage: window.localStorage });
      const sessionStashService = new SessionStashService({ tenantId, storage: window.localStorage });
      const dispatchService = new DispatchService({
        submissionService,
        spreadConfigService,
        telemetryService,
        ingestService,
        notifier: createDistroNotifier(),
      });
      const analyticsService = new AnalyticsService({ submissionService });
      const state = {
        dealers,
        telemetryService,
        ingestService,
        searchService,
        submissionService,
        spreadConfigService,
        sessionStashService,
        dispatchService,
        analyticsService,
        syncAdapter: null,
        syncToast: null,
      };
      const syncAdapter = new SyncAdapter({ tenantId, wsUrl: window.CARBOYZ_SYNC_WS_URL || null });
      syncAdapter.on('SUBMISSION_SYNCED', (payload) => {
        submissionService.receiveExternalSubmission(payload);
        hapticsService.vibrate();
        state.syncToast = { message: 'New lead received in cell' };
        render();
      });
      syncAdapter.on('TENANT_POLICY_SYNCED', () => render());
      syncAdapter.connect();
      state.syncAdapter = syncAdapter;
      tenantStateByTenantId.set(tenantId, state);
      if (!isOffline) {
        flushPendingSync(tenantId);
      }
      if (tenantId === CARBOYZ_TENANT_ID) {
        seedDirectInventory(ingestService);
        seedLocalDealers(ingestService);
      }
    }
    return tenantStateByTenantId.get(tenantId);
  }

  function switchTenant(tenantId) {
    const nextConfig = registry.get(tenantId);
    if (!nextConfig) {
      return;
    }
    activeTenantConfig = nextConfig;
    writeTenantIdToStorage(window.localStorage, tenantId);
    render();
  }

  async function runDiscovery(originDealerId, onProgress) {
    const state = getTenantState(activeTenantConfig.tenantId);
    const originDealer = state.dealers.find((dealer) => dealer.dealerId === originDealerId) ?? state.dealers[0];
    if (!originDealer) {
      throw new Error('No dealer available to scan from yet.');
    }

    const discoveryService = new DiscoveryService({
      telemetryService: state.telemetryService,
      vendorFeeds: VENDOR_FEEDS_BY_TENANT[activeTenantConfig.tenantId] ?? [],
    });

    const result = await discoveryService.scanRadius({
      origin: { lat: originDealer.lat, lng: originDealer.lng },
      radiusMiles: 50,
      tenantId: activeTenantConfig.tenantId,
      onProgress,
    });

    result.dealers.forEach((dealer) => {
      state.searchService.registerDealer(dealer);
      state.telemetryService.registerDealer(dealer);
      if (!state.dealers.some((existing) => existing.dealerId === dealer.dealerId)) {
        state.dealers.push(dealer);
      }
    });

    result.vehicleResults.forEach(({ vehicle }) => {
      state.ingestService.intake({
        dealerId: vehicle.dealerId,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        price: vehicle.price,
        mileage: vehicle.mileage,
        bodyStyle: vehicle.bodyStyle,
      });
    });

    hapticsService.vibrate();
    render();

    return result;
  }

  function render() {
    tenantConfigService.applyTenant(activeTenantConfig);

    const state = getTenantState(activeTenantConfig.tenantId);
    const dealerController = new DealerStudioController({
      ingestService: state.ingestService,
      telemetryService: state.telemetryService,
      hapticsService,
    });
    const buyerController = new BuyerSearchController({ searchService: state.searchService, shareService });
    const sellerController = new SellerSubmissionController({
      submissionService: state.submissionService,
      hapticsService,
      dispatchService: state.dispatchService,
      sessionStashService: state.sessionStashService,
      syncAdapter: state.syncAdapter,
    });
    const leadInboxController = new LeadInboxController({
      submissionService: state.submissionService,
      telemetryService: state.telemetryService,
      ingestService: state.ingestService,
      spreadConfigService: state.spreadConfigService,
      sessionStashService: state.sessionStashService,
    });
    const spreadConfigController = new SpreadConfigController({ spreadConfigService: state.spreadConfigService });
    const analyticsController = new AnalyticsController({ analyticsService: state.analyticsService });

    const brandSwitcher = renderBrandSwitcher(registry.list(), activeTenantConfig.tenantId, switchTenant);

    const sellView = renderSellerSubmissionView(sellerController, {
      sessionStashService: state.sessionStashService,
      prefill: pendingPrefill,
      tenantConfig: activeTenantConfig,
    });
    pendingPrefill = null;
    const activeSyncToast = state.syncToast;
    state.syncToast = null;
    const { section: leadsView, refresh: refreshLeadsView } = renderLeadInboxView(leadInboxController, {
      onSendCounter: (text) => shareService.share({ title: 'Counter Offer', text }),
      tenantConfig: activeTenantConfig,
      syncToast: activeSyncToast,
    });
    const adminView = renderSpreadConfigView(spreadConfigController);
    const { section: analyticsView, refresh: refreshAnalyticsView } = renderAnalyticsView(analyticsController);
    const harnessView = renderTestHarnessView({
      sellerController,
      submissionService: state.submissionService,
    }).section;
    const dealerView = renderDealerStudioView(
      dealerController,
      state.dealers,
      (card) => shareService.share(card.shareData),
      brandSwitcher,
    );
    const buyerView = renderBuyerSearchView(
      buyerController,
      state.dealers,
      () => state.ingestService.getInventory(),
      activeTenantConfig.tenantId,
      runDiscovery,
    );

    mapView.update(state.dealers, state.ingestService.getInventory());

    function handleTabSelect(tab) {
      activeTab = tab;
      sellView.hidden = tab !== 'sell';
      dealerView.hidden = tab !== 'dealer';
      buyerView.hidden = tab !== 'buyer';
      mapView.section.hidden = tab !== 'map';
      leadsView.hidden = tab !== 'leads';
      adminView.hidden = tab !== 'admin';
      analyticsView.hidden = tab !== 'analytics';
      harnessView.hidden = tab !== 'harness';
      sellBtn.setAttribute('aria-selected', String(tab === 'sell'));
      dealerBtn.setAttribute('aria-selected', String(tab === 'dealer'));
      buyerBtn.setAttribute('aria-selected', String(tab === 'buyer'));
      mapBtn.setAttribute('aria-selected', String(tab === 'map'));
      leadsBtn.setAttribute('aria-selected', String(tab === 'leads'));
      adminBtn.setAttribute('aria-selected', String(tab === 'admin'));
      analyticsBtn.setAttribute('aria-selected', String(tab === 'analytics'));
      harnessBtn.setAttribute('aria-selected', String(tab === 'harness'));
      bottomNavButtons.forEach((button, buttonTab) => {
        button.setAttribute('aria-selected', String(tab === buttonTab));
      });
      if (tab === 'map') mapView.mount();
      if (tab === 'leads') refreshLeadsView();
      if (tab === 'analytics') refreshAnalyticsView();
    }

    const { nav, sellBtn, dealerBtn, buyerBtn, mapBtn, leadsBtn, adminBtn, analyticsBtn, harnessBtn } = renderTabs(
      activeTab,
      (tab) => handleTabSelect(tab),
    );
    const { nav: bottomNav, buttons: bottomNavButtons } = renderBottomNavView(activeTab, (tab) => handleTabSelect(tab));
    sellView.hidden = activeTab !== 'sell';
    dealerView.hidden = activeTab !== 'dealer';
    buyerView.hidden = activeTab !== 'buyer';
    mapView.section.hidden = activeTab !== 'map';
    leadsView.hidden = activeTab !== 'leads';
    adminView.hidden = activeTab !== 'admin';
    analyticsView.hidden = activeTab !== 'analytics';
    harnessView.hidden = activeTab !== 'harness';

    const a2hsPrompt = renderPwaInstallPromptView({ tenantConfig: activeTenantConfig });

    const app = h('div', { class: 'app' }, [
      renderHeader(activeTenantConfig),
      renderOfflineBanner(isOffline),
      nav,
      sellView,
      dealerView,
      buyerView,
      mapView.section,
      leadsView,
      adminView,
      analyticsView,
      harnessView,
      bottomNav,
      a2hsPrompt?.el,
    ]);
    root.replaceChildren(app);
    if (activeTab === 'map') mapView.mount();
  }

  render();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app-root');
    if (root) {
      mountApp(root);
    }
  });
}
