import { h } from './App.js';
import { TIER_STRATEGIES } from '../services/SpreadConfigService.js';

const STRATEGY_OPTIONS = Object.values(TIER_STRATEGIES);

function percentToDisplay(percent) {
  return String(Math.round(percent * 10000) / 100);
}

function displayToPercent(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num / 100 : 0;
}

function renderTierRow(tier, { onRemove }) {
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

  const removeBtn = h('button', {
    class: 'button button--secondary tier-row__remove',
    type: 'button',
    text: 'Remove',
  });

  const row = h('div', { class: 'tier-row' }, [
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Min Price' }), minPriceInput]),
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Max Price' }), maxPriceInput]),
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Flat $' }), flatInput]),
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Percent %' }), percentInput]),
    h('div', { class: 'tier-row__field' }, [h('label', { text: 'Strategy' }), strategySelect]),
    removeBtn,
  ]);

  removeBtn.addEventListener('click', () => onRemove(row));

  return {
    row,
    readTier() {
      return {
        minPrice: Number(minPriceInput.value) || 0,
        maxPrice: maxPriceInput.value === '' ? null : Number(maxPriceInput.value),
        flatAmount: Number(flatInput.value) || 0,
        percent: displayToPercent(percentInput.value),
        strategy: strategySelect.value,
      };
    },
  };
}

function renderCompetitorSection(competitor, tiers) {
  const rowEntries = [];
  const rowsContainer = h('div', { class: 'tier-rows' });

  function addRow(tier) {
    const entry = renderTierRow(tier, {
      onRemove: (row) => {
        const index = rowEntries.findIndex((candidate) => candidate.row === row);
        if (index !== -1) {
          rowEntries.splice(index, 1);
        }
        row.remove();
      },
    });
    rowEntries.push(entry);
    rowsContainer.appendChild(entry.row);
  }

  tiers.forEach(addRow);

  const addBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Add Tier' });
  addBtn.addEventListener('click', () =>
    addRow({ minPrice: 0, maxPrice: null, flatAmount: 0, percent: 0, strategy: TIER_STRATEGIES.MAX }),
  );

  const section = h('div', { class: 'tier-section' }, [h('h3', { text: competitor }), rowsContainer, addBtn]);

  return {
    competitor,
    section,
    readTiers: () => rowEntries.map((entry) => entry.readTier()),
  };
}

export function renderSpreadConfigView(controller) {
  const sectionsContainer = h('div', { class: 'card-list' });
  const statusEl = h('p', { class: 'form__status', role: 'status', 'aria-live': 'polite' });
  let competitorSections = [];

  function renderSections() {
    sectionsContainer.replaceChildren();
    statusEl.textContent = '';
    statusEl.classList.remove('form__status--error');
    const { competitors } = controller.buildViewModel();
    competitorSections = competitors.map(({ competitor, tiers }) => renderCompetitorSection(competitor, tiers));
    competitorSections.forEach(({ section }) => sectionsContainer.appendChild(section));
  }

  const saveBtn = h('button', { class: 'button', type: 'button', text: 'Save Configuration' });
  saveBtn.addEventListener('click', () => {
    try {
      const tiersByCompetitor = Object.fromEntries(
        competitorSections.map((entry) => [entry.competitor, entry.readTiers()]),
      );
      controller.saveTiers(tiersByCompetitor);
      statusEl.textContent = 'Configuration saved.';
      statusEl.classList.remove('form__status--error');
    } catch (error) {
      statusEl.textContent = error.message;
      statusEl.classList.add('form__status--error');
    }
  });

  const resetBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Reset to Defaults' });
  resetBtn.addEventListener('click', () => {
    controller.resetToDefault();
    renderSections();
    statusEl.textContent = 'Reset to built-in defaults.';
  });

  renderSections();

  return h('section', { class: 'view', id: 'view-admin' }, [
    h('h2', { text: 'Admin' }),
    h('p', { class: 'view__subtitle', text: 'Edit counter-offer tier thresholds per competitor.' }),
    sectionsContainer,
    h('div', { class: 'form__row form__row--split' }, [saveBtn, resetBtn]),
    statusEl,
  ]);
}
