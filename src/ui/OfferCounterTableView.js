import { h } from './App.js';
import { projectMargin } from '../services/SpreadService.js';
import { REJECTION_REASONS } from '../models/Submission.js';
import { isPassedLead, offerSourceBadge, spreadBadge } from './LeadInboxView.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const mileageFormatter = new Intl.NumberFormat('en-US');
const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const OFFER_GRID_FILTERS = Object.freeze({
  ALL: 'ALL',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  COUNTER_SENT: 'COUNTER_SENT',
  PASSED: 'PASSED',
});

export const OFFER_GRID_FILTER_OPTIONS = [
  { value: OFFER_GRID_FILTERS.ALL, label: 'All' },
  { value: OFFER_GRID_FILTERS.NEEDS_REVIEW, label: 'Needs Review (Pending)' },
  { value: OFFER_GRID_FILTERS.COUNTER_SENT, label: 'Counter Sent' },
  { value: OFFER_GRID_FILTERS.PASSED, label: 'Passed' },
];

export const COUNTER_STEP_AMOUNTS = [100, 250, 500];

/** Exported for direct unit testing — newest submission first, by ISO timestamp. */
export function sortLeadsByTimestampDesc(leads) {
  return [...leads].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/** Exported for direct unit testing — the grid's quick filter bar. */
export function filterOfferGridLeads(leads, filter) {
  switch (filter) {
    case OFFER_GRID_FILTERS.NEEDS_REVIEW:
      return leads.filter((lead) => lead.status === 'PENDING_APPROVAL');
    case OFFER_GRID_FILTERS.COUNTER_SENT:
      return leads.filter((lead) => lead.status === 'AUTO_COUNTER_SENT');
    case OFFER_GRID_FILTERS.PASSED:
      return leads.filter((lead) => isPassedLead(lead.status));
    case OFFER_GRID_FILTERS.ALL:
    default:
      return leads;
  }
}

/**
 * Exported for direct unit testing — the grid's summary header chips, always computed from the
 * full (unfiltered) lead set so switching quick filters doesn't change the totals underneath.
 */
export function computeOfferGridSummary(leads) {
  const totalBids = leads.length;
  const pendingReviewCount = leads.filter((lead) => lead.status === 'PENDING_APPROVAL').length;
  const aggregateProjectedMargin = leads.reduce((sum, lead) => {
    if (typeof lead.projectedMargin === 'number') {
      return sum + lead.projectedMargin;
    }
    if (typeof lead.spreadResult?.spread === 'number') {
      return sum + lead.spreadResult.spread;
    }
    return sum;
  }, 0);

  return { totalBids, pendingReviewCount, aggregateProjectedMargin };
}

/**
 * Exported for direct unit testing — the live recalculation ticker behind the inline counter
 * stepper: projected dealer gross margin and its delta from the system-recommended counter, for
 * a candidate counterOfferAmount the desk is previewing before confirming.
 */
export function previewCounterAdjustment(lead, counterOfferAmount) {
  const projectedMargin = projectMargin({
    estimatedWholesaleValue: lead.spreadResult.estimatedWholesaleValue,
    counterOfferAmount,
  });
  return {
    projectedMargin,
    deltaFromRecommended: counterOfferAmount - lead.spreadResult.recommendedCounterOffer,
  };
}

function renderKpiChip(label, value) {
  return h('div', { class: 'kpi-card' }, [
    h('span', { class: 'kpi-card__label', text: label }),
    h('span', { class: 'kpi-card__value', text: value }),
  ]);
}

function renderFilterBar(activeFilter, onSelect) {
  const buttons = OFFER_GRID_FILTER_OPTIONS.map(({ value, label }) => {
    const btn = h('button', { class: 'button button--secondary', type: 'button', text: label });
    btn.addEventListener('click', () => onSelect(value));
    return btn;
  });
  return { bar: h('div', { class: 'card__actions filter-toggle' }, buttons), buttons };
}

function vehicleLabel(lead) {
  return [lead.vehicleTitle, `${mileageFormatter.format(lead.mileage)} mi`].filter(Boolean).join(' · ');
}

function competitorCellLabel(lead) {
  return `${lead.competitorLabel} · ${currencyFormatter.format(lead.competitorOfferAmount)}`;
}

function statusLabel(lead) {
  if (isPassedLead(lead.status)) {
    return 'Passed';
  }
  return lead.status.replace(/_/g, ' ');
}

function renderAdjustmentRow(lead, { onPreviewChange, onCancel, onConfirm }) {
  let workingAmount = Math.round(lead.proposedCounterOffer);

  const amountInput = h('input', {
    type: 'number',
    min: '0',
    class: 'card__counter-input',
    value: String(workingAmount),
  });
  const ticker = h('p', { class: 'card__meta', role: 'status', 'aria-live': 'polite' });

  function updateTicker() {
    const preview = onPreviewChange(workingAmount);
    const deltaLabel =
      preview.deltaFromRecommended === 0
        ? 'matches recommended'
        : `${preview.deltaFromRecommended > 0 ? '+' : ''}${currencyFormatter.format(preview.deltaFromRecommended)} vs. recommended`;
    ticker.textContent =
      preview.projectedMargin === null
        ? `Proposed: ${currencyFormatter.format(workingAmount)} (${deltaLabel})`
        : `Proposed: ${currencyFormatter.format(workingAmount)} (${deltaLabel}) · Projected Margin: ${currencyFormatter.format(preview.projectedMargin)}`;
  }

  function setWorkingAmount(amount) {
    workingAmount = Math.max(0, Math.round(amount));
    amountInput.value = String(workingAmount);
    updateTicker();
  }

  amountInput.addEventListener('input', () => setWorkingAmount(Number(amountInput.value) || 0));

  const stepperButtons = COUNTER_STEP_AMOUNTS.map((amount) => {
    const btn = h('button', {
      class: 'button button--secondary',
      type: 'button',
      text: `+${currencyFormatter.format(amount)}`,
    });
    btn.addEventListener('click', () => setWorkingAmount(workingAmount + amount));
    return btn;
  });

  const cancelBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Cancel' });
  cancelBtn.addEventListener('click', onCancel);
  const confirmBtn = h('button', { class: 'button', type: 'button', text: 'Confirm Counter' });
  confirmBtn.addEventListener('click', () => onConfirm(workingAmount));

  updateTicker();

  return h('tr', { class: 'offer-grid__adjust-row' }, [
    h('td', { colspan: '7' }, [
      h('div', { class: 'offer-grid__adjust-panel' }, [
        h('div', { class: 'card__actions' }, [...stepperButtons, amountInput]),
        ticker,
        h('div', { class: 'card__actions' }, [confirmBtn, cancelBtn]),
      ]),
    ]),
  ]);
}

function renderInspectDrawer() {
  const body = h('div', { class: 'offer-grid-drawer__body' });
  const closeBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Close' });
  const drawer = h('div', { class: 'offer-grid-drawer' }, [body, closeBtn]);
  const overlay = h('div', { class: 'modal-overlay', hidden: '' }, [drawer]);

  function close() {
    overlay.hidden = true;
    body.replaceChildren();
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  function open(lead) {
    const rows = [
      ['VIN', lead.vin ?? 'Not yet captured'],
      ['Mileage', `${mileageFormatter.format(lead.mileage)} mi`],
      ['ZIP', lead.zipCode ?? '—'],
      ['Competitor', lead.competitorLabel],
      ['Competitor Offer', currencyFormatter.format(lead.competitorOfferAmount)],
      ['Recommended Counter', currencyFormatter.format(lead.spreadResult.recommendedCounterOffer)],
      ['Proposed Counter', currencyFormatter.format(lead.proposedCounterOffer)],
      [
        'Estimated Wholesale Value',
        lead.spreadResult.estimatedWholesaleValue === null
          ? '—'
          : currencyFormatter.format(lead.spreadResult.estimatedWholesaleValue),
      ],
      ['Status', statusLabel(lead)],
    ];
    if (lead.modifiedBy) {
      rows.push(['Last Modified By', `${lead.modifiedBy} at ${timestampFormatter.format(new Date(lead.modifiedAt))}`]);
    }
    if (lead.rejectionReason) {
      rows.push(['Pass Reason', REJECTION_REASONS[lead.rejectionReason] ?? lead.rejectionReason]);
    }

    body.replaceChildren(
      h('h3', { class: 'modal__stage', text: lead.vehicleTitle }),
      ...rows.map(([label, value]) =>
        h('p', { class: 'card__meta' }, [h('strong', { text: `${label}: ` }), document.createTextNode(value)]),
      ),
    );
    overlay.hidden = false;
  }

  return { overlay, open };
}

function renderPassModal({ onConfirm }) {
  const select = h(
    'select',
    { class: 'modal__reject-select' },
    Object.entries(REJECTION_REASONS).map(([value, label]) => h('option', { value, text: label })),
  );
  const notesInput = h('textarea', { class: 'modal__reject-notes', rows: '3', placeholder: 'Optional notes...' });
  const cancelBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Cancel' });
  const confirmBtn = h('button', { class: 'button', type: 'button', text: 'Confirm Pass' });
  const modal = h('div', { class: 'modal modal--reject' }, [
    h('h3', { class: 'modal__stage', text: 'Pass on this Lead' }),
    h('label', { class: 'modal__reject-label', text: 'Reason' }),
    select,
    h('label', { class: 'modal__reject-label', text: 'Notes (optional)' }),
    notesInput,
    h('div', { class: 'card__actions' }, [cancelBtn, confirmBtn]),
  ]);
  const overlay = h('div', { class: 'modal-overlay', hidden: '' }, [modal]);

  let currentLeadId = null;

  function close() {
    overlay.hidden = true;
    currentLeadId = null;
    notesInput.value = '';
  }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  confirmBtn.addEventListener('click', () => {
    if (!currentLeadId) {
      return;
    }
    const leadId = currentLeadId;
    const rejectionReason = select.value;
    const rejectionNotes = notesInput.value.trim() || null;
    close();
    onConfirm(leadId, { rejectionReason, rejectionNotes });
  });

  function open(leadId) {
    currentLeadId = leadId;
    notesInput.value = '';
    overlay.hidden = false;
  }

  return { overlay, open };
}

export function renderOfferCounterTableView(controller, { focusSubmissionId = null } = {}) {
  const summaryRow = h('div', { class: 'kpi-row' });
  const tbody = h('tbody', {});
  const table = h('table', { class: 'data-table offer-grid__table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', { text: 'Timestamp' }),
        h('th', { text: 'Vehicle' }),
        h('th', { text: 'Competitor' }),
        h('th', { text: 'Market Spread / Margin' }),
        h('th', { text: 'Proposed Counter' }),
        h('th', { text: 'Status' }),
        h('th', { text: 'Actions' }),
      ]),
    ]),
    tbody,
  ]);

  let activeFilter = OFFER_GRID_FILTERS.ALL;
  let focusedId = focusSubmissionId;
  let openAdjustRowId = null;

  const { overlay: inspectOverlay, open: openInspectDrawer } = renderInspectDrawer();
  const { overlay: passOverlay, open: openPassModal } = renderPassModal({
    onConfirm: (id, payload) => {
      controller.rejectLead(id, payload);
      renderRows();
    },
  });

  const { bar: filterBar, buttons: filterButtons } = renderFilterBar(activeFilter, (filter) => {
    activeFilter = filter;
    renderRows();
  });

  function renderRows() {
    OFFER_GRID_FILTER_OPTIONS.forEach(({ value }, index) => {
      filterButtons[index].classList.toggle('button--active', activeFilter === value);
    });

    const allLeads = sortLeadsByTimestampDesc(controller.buildLeadViewModels());
    const summary = computeOfferGridSummary(allLeads);
    summaryRow.replaceChildren(
      renderKpiChip('Total Bids', String(summary.totalBids)),
      renderKpiChip('Pending Review', String(summary.pendingReviewCount)),
      renderKpiChip('Aggregate Projected Margin', currencyFormatter.format(summary.aggregateProjectedMargin)),
    );

    const leads = filterOfferGridLeads(allLeads, activeFilter);
    tbody.replaceChildren();

    if (leads.length === 0) {
      tbody.appendChild(
        h('tr', {}, [h('td', { colspan: '7', class: 'empty-state', text: 'No leads match this filter yet.' })]),
      );
      return;
    }

    leads.forEach((lead) => {
      const badge = spreadBadge(lead.spreadResult.status);
      const sourceBadge = offerSourceBadge(lead.offerSourceType, lead.vin);
      const canAdjust = lead.status === 'PENDING_APPROVAL';

      const spreadCell = h('td', {}, [
        h('span', { class: badge.className, text: badge.label }),
        sourceBadge ? h('span', { class: sourceBadge.className, text: sourceBadge.label }) : null,
      ]);

      const counterCell = h('td', {});
      if (canAdjust) {
        const counterBtn = h('button', {
          class: 'button button--secondary',
          type: 'button',
          text: currencyFormatter.format(lead.proposedCounterOffer),
        });
        counterBtn.addEventListener('click', () => {
          openAdjustRowId = openAdjustRowId === lead.id ? null : lead.id;
          renderRows();
        });
        counterCell.appendChild(counterBtn);
      } else {
        counterCell.appendChild(
          h('span', { text: currencyFormatter.format(lead.proposedCounterOffer) }),
        );
      }

      const actionsCell = h('td', { class: 'card__actions' });
      if (canAdjust) {
        const approveBtn = h('button', { class: 'button', type: 'button', text: 'Approve & Dispatch' });
        approveBtn.addEventListener('click', () => {
          controller.approveAndSend(lead.id, Math.round(lead.proposedCounterOffer));
          openAdjustRowId = null;
          renderRows();
        });
        const passBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Pass' });
        passBtn.addEventListener('click', () => openPassModal(lead.id));
        actionsCell.append(approveBtn, passBtn);
      }
      const inspectBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Inspect' });
      inspectBtn.addEventListener('click', () => openInspectDrawer(lead));
      actionsCell.appendChild(inspectBtn);

      const row = h('tr', { class: 'offer-grid__row' }, [
        h('td', { text: timestampFormatter.format(new Date(lead.timestamp)) }),
        h('td', { text: vehicleLabel(lead) }),
        h('td', { text: competitorCellLabel(lead) }),
        spreadCell,
        counterCell,
        h('td', { text: statusLabel(lead) }),
        actionsCell,
      ]);

      if (lead.id === focusedId) {
        row.classList.add('offer-grid__row--focused');
      }

      tbody.appendChild(row);

      if (openAdjustRowId === lead.id) {
        tbody.appendChild(
          renderAdjustmentRow(lead, {
            onPreviewChange: (amount) => previewCounterAdjustment(lead, amount),
            onCancel: () => {
              openAdjustRowId = null;
              renderRows();
            },
            onConfirm: (amount) => {
              controller.overrideCounterOffer(lead.id, amount);
              openAdjustRowId = null;
              renderRows();
            },
          }),
        );
      }
    });

    if (focusedId) {
      const focusedRow = tbody.querySelector('.offer-grid__row--focused');
      focusedRow?.scrollIntoView?.({ block: 'center' });
      focusedId = null;
    }
  }

  renderRows();

  const section = h('section', { class: 'view', id: 'view-offers' }, [
    h('h2', { text: 'Offer Counter Grid' }),
    h('p', { class: 'view__subtitle', text: 'Every submission, sorted newest first, with inline counter adjustment.' }),
    summaryRow,
    filterBar,
    table,
    inspectOverlay,
    passOverlay,
  ]);

  return {
    section,
    refresh: renderRows,
    focusLead(id) {
      focusedId = id;
      renderRows();
    },
  };
}
