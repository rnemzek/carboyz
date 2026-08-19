import { createTenantConfig } from '../config/tenantConfig.js';
import { Dealer } from '../models/Dealer.js';
import { TelemetryService } from '../services/TelemetryService.js';
import { SearchService } from '../services/SearchService.js';
import { IngestService } from '../services/IngestService.js';
import { HapticsService } from '../services/HapticsService.js';
import { ShareService } from '../services/ShareService.js';
import { applyTenantTheme } from './theme.js';
import { DealerStudioController } from './DealerStudioController.js';
import { BuyerSearchController } from './BuyerSearchController.js';

const BODY_STYLES = ['sedan', 'suv', 'truck', 'coupe', 'hatchback', 'van'];

const DEMO_TENANT_CONFIG = createTenantConfig({
  tenantId: 'demo-tenant',
  name: 'Carboyz Motors',
  themeColors: { primary: '#0057d9', secondary: '#1b1f27' },
});

const DEMO_DEALERS = [
  new Dealer({
    tenantId: DEMO_TENANT_CONFIG.tenantId,
    dealerId: 'dealer-downtown',
    name: 'Downtown Motors',
    lat: 39.7684,
    lng: -86.158,
  }),
  new Dealer({
    tenantId: DEMO_TENANT_CONFIG.tenantId,
    dealerId: 'dealer-north',
    name: 'North Auto Plaza',
    lat: 39.92,
    lng: -86.09,
  }),
  new Dealer({
    tenantId: DEMO_TENANT_CONFIG.tenantId,
    dealerId: 'dealer-eastside',
    name: 'Eastside Certified',
    lat: 39.77,
    lng: -85.95,
  }),
];

function h(tag, props = {}, children = []) {
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

function renderHeader(tenantConfig) {
  const header = h('header', { class: 'app__header' });
  if (tenantConfig.logoUrl) {
    header.appendChild(
      h('img', { class: 'app__logo', src: tenantConfig.logoUrl, alt: `${tenantConfig.name} logo` }),
    );
  }
  header.appendChild(h('h1', { class: 'app__title', text: tenantConfig.name }));
  return header;
}

function renderTabs(onSelect) {
  const dealerBtn = h('button', {
    class: 'tabs__button',
    type: 'button',
    role: 'tab',
    'aria-selected': 'true',
    text: 'Dealer Studio',
    onClick: () => onSelect('dealer'),
  });
  const buyerBtn = h('button', {
    class: 'tabs__button',
    type: 'button',
    role: 'tab',
    'aria-selected': 'false',
    text: 'Buyer Search',
    onClick: () => onSelect('buyer'),
  });
  const nav = h('nav', { class: 'tabs', role: 'tablist' }, [dealerBtn, buyerBtn]);
  return { nav, dealerBtn, buyerBtn };
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

function renderDealerStudioView(dealerController, dealers, onShare) {
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

  return h('section', { class: 'view', id: 'view-dealer' }, [form, h('h2', { text: 'Inventory' }), list]);
}

function renderBuyerSearchView(buyerController, dealers, getSearchableVehicles) {
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
    h('button', { class: 'button', type: 'submit', text: 'Search' }),
  ]);

  const results = h('div', { class: 'card-list' });

  function runSearch() {
    const data = new FormData(form);
    const criteria = { tenantId: DEMO_TENANT_CONFIG.tenantId };

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
  applyTenantTheme(DEMO_TENANT_CONFIG);
  document.title = DEMO_TENANT_CONFIG.name;

  const telemetryService = new TelemetryService({ dealers: DEMO_DEALERS });
  const ingestService = new IngestService({ telemetryService, tenantId: DEMO_TENANT_CONFIG.tenantId });
  const searchService = new SearchService({ dealers: DEMO_DEALERS });
  const hapticsService = new HapticsService();
  const shareService = new ShareService();

  const dealerController = new DealerStudioController({ ingestService, telemetryService, hapticsService });
  const buyerController = new BuyerSearchController({ searchService, shareService });

  const dealerView = renderDealerStudioView(dealerController, DEMO_DEALERS, (card) =>
    shareService.share(card.shareData),
  );
  const buyerView = renderBuyerSearchView(buyerController, DEMO_DEALERS, () => ingestService.getInventory());

  const { nav, dealerBtn, buyerBtn } = renderTabs((tab) => {
    const dealerActive = tab === 'dealer';
    dealerView.hidden = !dealerActive;
    buyerView.hidden = dealerActive;
    dealerBtn.setAttribute('aria-selected', String(dealerActive));
    buyerBtn.setAttribute('aria-selected', String(!dealerActive));
  });

  const app = h('div', { class: 'app' }, [renderHeader(DEMO_TENANT_CONFIG), nav, dealerView, buyerView]);
  root.replaceChildren(app);
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('app-root');
    if (root) {
      mountApp(root);
    }
  });
}
