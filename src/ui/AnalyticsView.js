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
  [DATE_RANGE_PRESETS.LAST_60_DAYS]: 'Last 60 Days',
  [DATE_RANGE_PRESETS.LAST_90_DAYS]: 'Last 90 Days',
  [DATE_RANGE_PRESETS.ALL_TIME]: 'All Time',
};

const APPROVAL_TYPE_LABELS = {
  AUTO_DISPATCH: 'Auto-Dispatched',
  HUMAN_APPROVED: 'Human-Approved',
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

function escapeSvgText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildLinearScale(values, range) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (value) => range * ((value - min) / span);
}

/**
 * Renders a responsive SVG line chart (as a markup string, matching the qrEncoder.js precedent
 * for SVG in this codebase, since `h()` builds plain HTML elements and can't create real SVG
 * nodes) with vertical policy-version-pin overlays positioned on the same time axis as the line.
 */
function renderTimeSeriesChartSvg({ timeSeries, versionPins, valueKey, formatValue }) {
  const width = 640;
  const height = 200;
  const padding = 28;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  if (timeSeries.length === 0) {
    return null;
  }

  const points = timeSeries.map((bucket) => ({
    time: new Date(`${bucket.date}T00:00:00.000Z`).getTime(),
    value: bucket[valueKey],
  }));
  const pinTimes = versionPins.map((pin) => new Date(pin.timestamp).getTime());
  const xScale = buildLinearScale([...points.map((p) => p.time), ...pinTimes], chartWidth);
  const yScale = buildLinearScale([0, ...points.map((p) => p.value)], chartHeight);

  const linePoints = points.map((p) => `${padding + xScale(p.time)},${padding + chartHeight - yScale(p.value)}`).join(' ');

  const dots = points
    .map(
      (p) =>
        `<circle cx="${padding + xScale(p.time)}" cy="${padding + chartHeight - yScale(p.value)}" r="3" class="analytics-chart__point"/>`,
    )
    .join('');

  const pins = versionPins
    .map((pin) => {
      const x = padding + xScale(new Date(pin.timestamp).getTime());
      return (
        `<g class="analytics-chart__pin">` +
        `<line x1="${x}" x2="${x}" y1="${padding}" y2="${padding + chartHeight}" class="analytics-chart__pin-line"/>` +
        `<text x="${x + 4}" y="${padding + 12}" class="analytics-chart__pin-label">${escapeSvgText(pin.policyVersionId)}</text>` +
        `</g>`
      );
    })
    .join('');

  const lastPoint = points[points.length - 1];
  const lastLabel = formatValue(lastPoint.value);

  return (
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeSvgText(lastLabel)} latest">` +
    `<line x1="${padding}" x2="${padding}" y1="${padding}" y2="${padding + chartHeight}" class="analytics-chart__axis"/>` +
    `<line x1="${padding}" x2="${width - padding}" y1="${padding + chartHeight}" y2="${padding + chartHeight}" class="analytics-chart__axis"/>` +
    `${pins}` +
    `<polyline points="${linePoints}" class="analytics-chart__line" fill="none"/>` +
    `${dots}` +
    `</svg>`
  );
}

function renderTimeSeriesChart(title, timeSeries, versionPins, valueKey, formatValue) {
  const svgMarkup = renderTimeSeriesChartSvg({ timeSeries, versionPins, valueKey, formatValue });
  const container = h('div', { class: 'analytics__chart' }, [h('h3', { text: title })]);

  if (!svgMarkup) {
    container.appendChild(h('p', { class: 'empty-state', text: 'No time-series data for this filter yet.' }));
    return container;
  }

  const chartHost = h('div', { class: 'analytics-chart__host' });
  chartHost.innerHTML = svgMarkup;
  container.appendChild(chartHost);
  return container;
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

  const priceTierSelect = h('select', { 'aria-label': 'Price Band' }, [
    h('option', { value: '', text: 'All Price Bands' }),
    ...controller.getPriceTierOptions().map(({ key, label }) => h('option', { value: key, text: label })),
  ]);

  const approvalTypeSelect = h('select', { 'aria-label': 'Approval Type' }, [
    h('option', { value: '', text: 'All Approval Types' }),
    ...controller.getApprovalTypeOptions().map((type) => h('option', { value: type, text: APPROVAL_TYPE_LABELS[type] ?? type })),
  ]);

  const kpiRow = h('div', { class: 'kpi-row' });
  const chartsContainer = h('div', { class: 'analytics__charts' });
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
      priceTier: priceTierSelect.value,
      approvalType: approvalTypeSelect.value,
    });
    const versionPins = controller.getPolicyVersionPins();

    kpiRow.replaceChildren(
      renderKpiCard('Total Volume', String(metrics.totalVolume)),
      renderKpiCard('Win Rate', formatPercent(metrics.winRate)),
      renderKpiCard('Avg Response Time', formatSeconds(metrics.avgResponseTimeMs)),
      renderKpiCard('Total Expected Margin', currencyFormatter.format(metrics.totalExpectedMargin)),
    );

    chartsContainer.replaceChildren(
      renderTimeSeriesChart('Conversion Trend', metrics.timeSeries, versionPins, 'winRate', formatPercent),
      renderTimeSeriesChart('Margin Trend', metrics.timeSeries, versionPins, 'totalExpectedMargin', (value) =>
        currencyFormatter.format(value),
      ),
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
  priceTierSelect.addEventListener('change', refresh);
  approvalTypeSelect.addEventListener('change', refresh);

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
      h('div', {}, [h('label', { text: 'Price Band' }), priceTierSelect]),
      h('div', {}, [h('label', { text: 'Approval Type' }), approvalTypeSelect]),
    ]),
    kpiRow,
    chartsContainer,
    competitorTableContainer,
    priceTierTableContainer,
    approvalSplitContainer,
  ]);

  return { section, refresh };
}
