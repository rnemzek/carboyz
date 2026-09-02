import { h } from './App.js';
import { TIER_STRATEGIES } from '../services/SpreadConfigService.js';

const STRATEGY_OPTIONS = Object.values(TIER_STRATEGIES);

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatPercent(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}

function formatSignedPercent(fraction) {
  const sign = fraction > 0 ? '+' : '';
  return `${sign}${(fraction * 100).toFixed(1)}%`;
}

function formatSignedCurrency(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${currencyFormatter.format(value)}`;
}

function formatSignedCount(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
}

function percentToDisplay(percent) {
  return String(Math.round(percent * 10000) / 100);
}

function displayToPercent(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num / 100 : 0;
}

function renderTierRow(tier) {
  const minPriceInput = h('input', {
    type: 'number',
    min: '0',
    placeholder: 'Min Price',
    value: String(tier.minPrice),
  });
  const maxPriceInput = h('input', {
    type: 'number',
    min: '0',
    placeholder: 'Max Price (blank = unbounded)',
    value: tier.maxPrice === null ? '' : String(tier.maxPrice),
  });
  const flatInput = h('input', { type: 'number', min: '0', placeholder: 'Flat $', value: String(tier.flatAmount) });
  const percentInput = h('input', {
    type: 'number',
    min: '0',
    step: '0.1',
    placeholder: 'Percent %',
    value: percentToDisplay(tier.percent),
  });
  const strategySelect = h(
    'select',
    {},
    STRATEGY_OPTIONS.map((strategy) => h('option', { value: strategy, text: strategy })),
  );
  strategySelect.value = tier.strategy ?? TIER_STRATEGIES.MAX;

  const autoApproveInput = h('input', { type: 'checkbox' });
  autoApproveInput.checked = tier.autoApprove ?? false;

  const row = h('div', { class: 'tier-row' }, [
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Min Price' }), minPriceInput]),
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Max Price' }), maxPriceInput]),
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Flat $' }), flatInput]),
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Percent %' }), percentInput]),
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Strategy' }), strategySelect]),
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Auto-Dispatch Counter Offer' }), autoApproveInput]),
  ]);

  return {
    row,
    readTier() {
      return {
        minPrice: Number(minPriceInput.value) || 0,
        maxPrice: maxPriceInput.value === '' ? null : Number(maxPriceInput.value),
        flatAmount: Number(flatInput.value) || 0,
        percent: displayToPercent(percentInput.value),
        strategy: strategySelect.value,
        autoApprove: autoApproveInput.checked,
      };
    },
  };
}

function renderCompetitorSection(competitor, tiers) {
  const rowEntries = tiers.map((tier) => renderTierRow(tier));
  const rowsContainer = h(
    'div',
    { class: 'tier-rows' },
    rowEntries.map((entry) => entry.row),
  );
  const section = h('div', { class: 'tier-section' }, [h('h3', { text: competitor }), rowsContainer]);

  return {
    competitor,
    section,
    readTiers: () => rowEntries.map((entry) => entry.readTier()),
  };
}

function renderComparisonCard(title, summary) {
  return h('div', { class: 'comparison-card' }, [
    h('h3', { class: 'comparison-card__title', text: title }),
    h('div', { class: 'kpi-row' }, [
      h('div', { class: 'kpi-card' }, [
        h('span', { class: 'kpi-card__label', text: 'Win Rate' }),
        h('span', { class: 'kpi-card__value', text: formatPercent(summary.winRate) }),
      ]),
      h('div', { class: 'kpi-card' }, [
        h('span', { class: 'kpi-card__label', text: 'Total Gross Margin' }),
        h('span', { class: 'kpi-card__value', text: currencyFormatter.format(summary.totalGrossMargin) }),
      ]),
      h('div', { class: 'kpi-card' }, [
        h('span', { class: 'kpi-card__label', text: 'Avg Margin / Won Deal' }),
        h('span', { class: 'kpi-card__value', text: currencyFormatter.format(summary.avgMarginPerWonDeal) }),
      ]),
      h('div', { class: 'kpi-card' }, [
        h('span', { class: 'kpi-card__label', text: 'Auto-Approval Volume' }),
        h('span', { class: 'kpi-card__value', text: String(summary.autoApprovalVolume) }),
      ]),
    ]),
  ]);
}

function renderDeltaRow(delta) {
  return h('div', { class: 'kpi-row' }, [
    h('div', { class: 'kpi-card' }, [
      h('span', { class: 'kpi-card__label', text: 'Win Rate Shift' }),
      h('span', { class: 'kpi-card__value', text: formatSignedPercent(delta.winRate) }),
    ]),
    h('div', { class: 'kpi-card' }, [
      h('span', { class: 'kpi-card__label', text: 'Gross Margin Shift' }),
      h('span', { class: 'kpi-card__value', text: formatSignedCurrency(delta.totalGrossMargin) }),
    ]),
    h('div', { class: 'kpi-card' }, [
      h('span', { class: 'kpi-card__label', text: 'Avg Margin/Deal Shift' }),
      h('span', { class: 'kpi-card__value', text: formatSignedCurrency(delta.avgMarginPerWonDeal) }),
    ]),
    h('div', { class: 'kpi-card' }, [
      h('span', { class: 'kpi-card__label', text: 'Auto-Approval Volume Shift' }),
      h('span', { class: 'kpi-card__value', text: formatSignedCount(delta.autoApprovalVolume) }),
    ]),
  ]);
}

export function renderSimulationView(controller) {
  const sectionsContainer = h('div', { class: 'card-list' });
  const statusEl = h('p', { class: 'form__status', role: 'status', 'aria-live': 'polite' });
  const resultsContainer = h('div', { class: 'simulation__results' });
  let competitorSections = [];

  function renderSections() {
    sectionsContainer.replaceChildren();
    const { competitors } = controller.buildCandidateSeed();
    competitorSections = competitors.map(({ competitor, tiers }) => renderCompetitorSection(competitor, tiers));
    competitorSections.forEach(({ section }) => sectionsContainer.appendChild(section));
  }

  const runBtn = h('button', { class: 'button', type: 'button', text: 'Run Simulation' });
  runBtn.addEventListener('click', () => {
    try {
      const tiersByCompetitor = Object.fromEntries(
        competitorSections.map((entry) => [entry.competitor, entry.readTiers()]),
      );
      const { sampleSize, excludedCount, current, candidate, delta } = controller.runSimulation(tiersByCompetitor);
      statusEl.textContent =
        sampleSize === 0
          ? 'No closed historical submissions with resolvable pricing data to simulate against yet.'
          : `Simulated against ${sampleSize} closed submission(s) (${excludedCount} excluded — open or missing pricing data).`;
      statusEl.classList.remove('form__status--error');
      resultsContainer.replaceChildren(
        h('div', { class: 'comparison-row' }, [
          renderComparisonCard('Current Policy', current),
          renderComparisonCard('Candidate Policy', candidate),
        ]),
        h('h3', { text: 'Projected Deltas' }),
        renderDeltaRow(delta),
      );
    } catch (error) {
      statusEl.textContent = error.message;
      statusEl.classList.add('form__status--error');
      resultsContainer.replaceChildren();
    }
  });

  renderSections();

  return h('section', { class: 'view', id: 'view-simulation' }, [
    h('h2', { text: 'What-If Simulation' }),
    h('p', {
      class: 'view__subtitle',
      text: 'Adjust candidate tier offsets and auto-approval thresholds, then replay closed historical submissions to project the impact before deploying.',
    }),
    sectionsContainer,
    runBtn,
    statusEl,
    resultsContainer,
  ]);
}
