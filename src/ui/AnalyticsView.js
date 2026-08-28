import { h } from './App.js';
import { DATE_RANGE_PRESETS } from '../services/AnalyticsService.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const DATE_RANGE_LABELS = {
  [DATE_RANGE_PRESETS.LAST_7_DAYS]: 'Last 7 Days',
  [DATE_RANGE_PRESETS.LAST_30_DAYS]: 'Last 30 Days',
  [DATE_RANGE_PRESETS.ALL_TIME]: 'All Time',
};

function formatPercent(fraction) {
  return `${(fraction * 100).toFixed(1)}%`;
}

function formatSeconds(ms) {
  if (ms === null || ms === undefined) {
    return '—';
  }
  return `${Math.round(ms / 1000)}s`;
}

function formatCurrencyOrDash(value) {
  return value === null || value === undefined ? '—' : currencyFormatter.format(value);
}

function renderKpiCard(label, value) {
  return h('div', { class: 'kpi-card' }, [
    h('span', { class: 'kpi-card__label', text: label }),
    h('span', { class: 'kpi-card__value', text: value }),
  ]);
}

function renderDataBarCell(fraction) {
  return h('div', { class: 'data-bar' }, [
    h('div', { class: 'data-bar__fill', style: `width: ${Math.round(fraction * 100)}%` }),
    h('span', { class: 'data-bar__label', text: formatPercent(fraction) }),
  ]);
}

function renderCompetitorTable(competitorMatrix) {
  const rows =
    competitorMatrix.length === 0
      ? [
          h('tr', {}, [
            h('td', { colspan: '5', class: 'empty-state', text: 'No competitor data for this filter yet.' }),
          ]),
        ]
      : competitorMatrix.map((row) =>
          h('tr', {}, [
            h('td', { text: row.competitor }),
            h('td', { text: String(row.volume) }),
            h('td', { text: formatCurrencyOrDash(row.avgCounterOffer) }),
            h('td', {}, [renderDataBarCell(row.winRate)]),
            h('td', { text: currencyFormatter.format(row.totalMargin) }),
          ]),
        );

  return h('table', { class: 'data-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', { text: 'Competitor' }),
        h('th', { text: 'Volume' }),
        h('th', { text: 'Avg Counter' }),
        h('th', { text: 'Win Rate' }),
        h('th', { text: 'Total Margin' }),
      ]),
    ]),
    h('tbody', {}, rows),
  ]);
}

function renderPriceTierTable(priceTierDistribution) {
  const rows = priceTierDistribution.map((row) =>
    h('tr', {}, [
      h('td', { text: row.label }),
      h('td', { text: String(row.volume) }),
      h('td', {}, [renderDataBarCell(row.winRate)]),
    ]),
  );

  return h('table', { class: 'data-table' }, [
    h('thead', {}, [
      h('tr', {}, [h('th', { text: 'Price Bracket' }), h('th', { text: 'Volume' }), h('th', { text: 'Win Rate' })]),
    ]),
    h('tbody', {}, rows),
  ]);
}

function renderApprovalSplit(approvalSplit) {
  const { autoDispatchPct, humanApprovedPct, autoDispatchCount, humanApprovedCount } = approvalSplit;
  return h('div', { class: 'approval-split' }, [
    h('div', { class: 'approval-split-bar' }, [
      h('div', {
        class: 'approval-split-bar__segment approval-split-bar__segment--auto',
        style: `width: ${Math.round(autoDispatchPct * 100)}%`,
      }),
      h('div', {
        class: 'approval-split-bar__segment approval-split-bar__segment--human',
        style: `width: ${Math.round(humanApprovedPct * 100)}%`,
      }),
    ]),
    h('p', {
      class: 'approval-split__readout',
      text: `Auto-Dispatched: ${autoDispatchCount} (${formatPercent(autoDispatchPct)}) · Human-Approved: ${humanApprovedCount} (${formatPercent(humanApprovedPct)})`,
    }),
  ]);
}

export function renderAnalyticsView(controller) {
  const dateRangeSelect = h(
    'select',
    { 'aria-label': 'Date Range' },
    controller.getDateRangePresets().map((preset) => h('option', { value: preset, text: DATE_RANGE_LABELS[preset] })),
  );
  dateRangeSelect.value = DATE_RANGE_PRESETS.ALL_TIME;

  const competitorSelect = h('select', { 'aria-label': 'Competitor' }, [
    h('option', { value: '', text: 'All Competitors' }),
  ]);

  const kpiRow = h('div', { class: 'kpi-row' });
  const competitorTableContainer = h('div', { class: 'analytics__table-container' });
  const priceTierTableContainer = h('div', { class: 'analytics__table-container' });
  const approvalSplitContainer = h('div', { class: 'analytics__table-container' });

  function renderCompetitorOptions() {
    const current = competitorSelect.value;
    competitorSelect.replaceChildren(
      h('option', { value: '', text: 'All Competitors' }),
      ...controller.getCompetitorOptions().map((competitor) => h('option', { value: competitor, text: competitor })),
    );
    competitorSelect.value = current;
  }

  function refresh() {
    renderCompetitorOptions();
    const metrics = controller.buildViewModel({
      dateRange: dateRangeSelect.value,
      competitor: competitorSelect.value,
    });

    kpiRow.replaceChildren(
      renderKpiCard('Total Volume', String(metrics.totalVolume)),
      renderKpiCard('Win Rate', formatPercent(metrics.winRate)),
      renderKpiCard('Avg Response Time', formatSeconds(metrics.avgResponseTimeMs)),
      renderKpiCard('Total Expected Margin', currencyFormatter.format(metrics.totalExpectedMargin)),
    );

    competitorTableContainer.replaceChildren(
      h('h3', { text: 'Competitor Comparison' }),
      renderCompetitorTable(metrics.competitorMatrix),
    );
    priceTierTableContainer.replaceChildren(
      h('h3', { text: 'Price Bracket Distribution' }),
      renderPriceTierTable(metrics.priceTierDistribution),
    );
    approvalSplitContainer.replaceChildren(
      h('h3', { text: 'Approval Method Split' }),
      renderApprovalSplit(metrics.approvalSplit),
    );
  }

  dateRangeSelect.addEventListener('change', refresh);
  competitorSelect.addEventListener('change', refresh);

  refresh();

  const section = h('section', { class: 'view', id: 'view-analytics' }, [
    h('h2', { text: 'Analytics' }),
    h('p', {
      class: 'view__subtitle',
      text: 'Conversion, margin, and speed-to-lead performance across submissions.',
    }),
    h('div', { class: 'analytics__filters form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Date Range' }), dateRangeSelect]),
      h('div', {}, [h('label', { text: 'Competitor' }), competitorSelect]),
    ]),
    kpiRow,
    competitorTableContainer,
    priceTierTableContainer,
    approvalSplitContainer,
  ]);

  return { section, refresh };
}
