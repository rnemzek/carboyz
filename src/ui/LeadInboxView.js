import { h } from './App.js';
import { downloadAppraisalSheet } from '../utils/appraisalPdfGenerator.js';
import { renderQrSvg as renderPairingQrSvg } from '@nemzilla/qr-core';
import { REJECTION_REASONS } from '../models/Submission.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const mileageFormatter = new Intl.NumberFormat('en-US');

const STATUS_ACTIONS = [
  { status: 'IN_REVIEW', label: 'Mark In Review' },
  { status: 'OFFER_BEATEN', label: 'Offer Beaten' },
  { status: 'DECLINED', label: 'Decline' },
];

const BADGE_LABELS = {
  GREENLIGHT: 'Greenlight',
  MARGINAL: 'Marginal',
  PASS: 'Pass',
  NO_DATA: 'No Market Data',
};

const DISPATCH_BADGES = {
  PENDING_APPROVAL: { label: 'Pending Sign-off', className: 'badge badge--pending-approval' },
  AUTO_COUNTER_SENT: { label: 'Auto-Countered', className: 'badge badge--auto-countered' },
};

const PASSED_BADGE = { label: '[PASSED]', className: 'badge badge--passed' };

// Desk nag threshold (UOW-50): mirrors tenantConfig's default nagIntervalMinutes so the badge
// lights up in step with when LeadEscalationService actually fires the SMS.
const NEEDS_REVIEW_THRESHOLD_MINUTES = 15;
const NEEDS_REVIEW_BADGE = { label: '[NEEDS REVIEW - 15m+]', className: 'badge badge--needs-review' };

const escalatedAtFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });

/**
 * Exported for direct unit testing — a PENDING_APPROVAL lead that's waited past the nag
 * threshold gets the high-visibility pulse badge; anything else (including already-passed or
 * already-countered leads) gets none.
 */
export function needsReviewBadge(status, elapsedMinutes) {
  if (status !== 'PENDING_APPROVAL' || elapsedMinutes < NEEDS_REVIEW_THRESHOLD_MINUTES) {
    return null;
  }
  return NEEDS_REVIEW_BADGE;
}

/** Exported for direct unit testing — null until the desk has actually been nagged. */
export function formatEscalatedAtLabel(nagSentAt) {
  if (!nagSentAt) {
    return null;
  }
  return `Escalated to desk at ${escalatedAtFormatter.format(new Date(nagSentAt))}`;
}

/** A rejected ("passed") lead is terminal: counter actions are disabled and it moves to the
 * Lead Inbox's "Passed / Closed Leads" filter instead of "Active Leads". */
export function isPassedLead(status) {
  return status === 'REJECTED';
}

// ESTIMATE: the competitor offer came from a VIN-less "Estimate" screen (Submission.OFFER_SOURCE_TYPES).
// NO_VIN_ESTIMATE is a derived third state (UOW-47): an ESTIMATE lead that still has no vin gets
// the outline "preliminary" treatment instead of the solid estimate badge below.
const OFFER_SOURCE_BADGES = {
  NO_VIN_ESTIMATE: { label: '[PRELIMINARY - NO VIN]', className: 'badge badge--preliminary-no-vin' },
  ESTIMATE: { label: '[ESTIMATE COUNTER]', className: 'badge badge--estimate-counter' },
  FIRM_OFFER: { label: '[FIRM COUNTER]', className: 'badge badge--firm-counter' },
};

/** Exported for reuse by OfferCounterTableView.js's Market Spread / Margin Badge column. */
export function spreadBadge(status) {
  const className = `badge badge--${status.toLowerCase().replace('_', '-')}`;
  return { label: BADGE_LABELS[status] ?? BADGE_LABELS.NO_DATA, className };
}

/**
 * Exported for direct unit testing (no DOM dependency) — mirrors spreadBadge()'s pure lookup
 * shape. `vin` is optional and only matters when offerSourceType is ESTIMATE: omitted or falsy
 * downgrades the badge to the no-VIN "preliminary" state.
 */
export function offerSourceBadge(offerSourceType, vin) {
  if (offerSourceType === 'ESTIMATE' && !vin) {
    return OFFER_SOURCE_BADGES.NO_VIN_ESTIMATE;
  }
  return OFFER_SOURCE_BADGES[offerSourceType] ?? null;
}

function renderDocumentModal() {
  const content = h('div', { class: 'modal__doc-content' });
  const closeBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Close' });
  const modal = h('div', { class: 'modal modal--doc' }, [content, closeBtn]);
  const overlay = h('div', { class: 'modal-overlay', hidden: '' }, [modal]);

  function close() {
    overlay.hidden = true;
    content.replaceChildren();
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  function open(dataUrl) {
    content.replaceChildren();
    if (dataUrl.startsWith('data:application/pdf')) {
      content.appendChild(
        h('a', { class: 'button', href: dataUrl, target: '_blank', rel: 'noopener', text: 'Open PDF Document' }),
      );
    } else {
      content.appendChild(h('img', { class: 'modal__doc-image', src: dataUrl, alt: 'Uploaded offer document' }));
    }
    overlay.hidden = false;
  }

  return { overlay, open };
}

function renderLeadCard(
  lead,
  { onStatusChange, onViewDocument, onApproveAndSend, onRejectLead, onSendCounter, onDownloadAppraisal },
) {
  const passed = isPassedLead(lead.status);
  const badge = spreadBadge(lead.spreadResult.status);
  const dispatchBadge = passed ? null : DISPATCH_BADGES[lead.status];
  const sourceBadge = offerSourceBadge(lead.offerSourceType, lead.vin);
  const elapsedMinutes = lead.timestamp ? (Date.now() - new Date(lead.timestamp).getTime()) / 60000 : 0;
  const reviewBadge = needsReviewBadge(lead.status, elapsedMinutes);
  const escalatedAtLabel = formatEscalatedAtLabel(lead.nagSentAt);

  const top = h('div', { class: 'card__top' }, [
    h('h3', { class: 'card__title', text: lead.vehicleTitle }),
    h('span', { class: badge.className, text: badge.label }),
    passed ? h('span', { class: PASSED_BADGE.className, text: PASSED_BADGE.label }) : null,
    dispatchBadge ? h('span', { class: dispatchBadge.className, text: dispatchBadge.label }) : null,
    sourceBadge ? h('span', { class: sourceBadge.className, text: sourceBadge.label }) : null,
    reviewBadge ? h('span', { class: reviewBadge.className, text: reviewBadge.label }) : null,
  ]);

  const meta = h('div', { class: 'card__meta' }, [
    h('span', { text: `${mileageFormatter.format(lead.mileage)} mi` }),
    h('span', { text: `ZIP ${lead.zipCode}` }),
    h('span', { text: lead.competitorLabel }),
    escalatedAtLabel ? h('span', { class: 'card__meta--subtle', text: escalatedAtLabel }) : null,
  ]);

  const offers = h('div', { class: 'card__meta' }, [
    h('span', { text: `Competitor Offer: ${currencyFormatter.format(lead.competitorOfferAmount)}` }),
    h('span', {
      class: 'card__price',
      text: `Recommended Counter: ${currencyFormatter.format(lead.spreadResult.recommendedCounterOffer)}`,
    }),
  ]);

  const actions = h('div', { class: 'card__actions' });
  if (lead.offerDocument) {
    const viewBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'View Document' });
    viewBtn.addEventListener('click', () => onViewDocument(lead.offerDocument));
    actions.appendChild(viewBtn);
  }

  if (passed) {
    const reason = REJECTION_REASONS[lead.rejectionReason] ?? lead.rejectionReason;
    actions.appendChild(
      h('p', { class: 'card__meta', text: reason ? `Passed: ${reason}` : 'Passed' }),
    );
  } else if (lead.status === 'PENDING_APPROVAL') {
    const counterInput = h('input', {
      type: 'number',
      min: '0',
      class: 'card__counter-input',
      value: String(Math.round(lead.spreadResult.recommendedCounterOffer)),
    });
    const modifyBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Modify Counter' });
    modifyBtn.addEventListener('click', () => {
      counterInput.focus();
      counterInput.select();
    });
    const approveBtn = h('button', { class: 'button', type: 'button', text: 'Approve & Send' });
    approveBtn.addEventListener('click', () => onApproveAndSend(lead.id, Number(counterInput.value)));
    const rejectBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Pass / Reject' });
    rejectBtn.addEventListener('click', () => onRejectLead(lead.id));
    actions.appendChild(counterInput);
    actions.appendChild(modifyBtn);
    actions.appendChild(approveBtn);
    actions.appendChild(rejectBtn);
  } else if (lead.status === 'AUTO_COUNTER_SENT') {
    const sendBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Send Counter' });
    sendBtn.addEventListener('click', async () => {
      sendBtn.disabled = true;
      const result = await onSendCounter(lead.counterMessage);
      sendBtn.disabled = false;
      sendBtn.textContent = result?.shared ? 'Shared!' : 'Send Counter';
    });
    actions.appendChild(sendBtn);

    if (onDownloadAppraisal) {
      const downloadBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Download Appraisal Sheet' });
      downloadBtn.addEventListener('click', () => onDownloadAppraisal(lead.id));
      actions.appendChild(downloadBtn);
    }
  } else {
    STATUS_ACTIONS.forEach(({ status, label }) => {
      const btn = h('button', {
        class: 'button button--secondary',
        type: 'button',
        text: label,
        disabled: lead.status === status ? '' : undefined,
      });
      btn.addEventListener('click', () => onStatusChange(lead.id, status));
      actions.appendChild(btn);
    });
  }

  return h('article', { class: 'card' }, [top, meta, offers, actions]);
}

function renderRejectionModal({ onConfirm }) {
  const select = h(
    'select',
    { class: 'modal__reject-select' },
    Object.entries(REJECTION_REASONS).map(([value, label]) => h('option', { value, text: label })),
  );
  const notesInput = h('textarea', {
    class: 'modal__reject-notes',
    rows: '3',
    placeholder: 'Optional notes for the desk...',
  });
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

function renderSyncToast(syncToast) {
  if (!syncToast) {
    return null;
  }
  const toast = h('div', {
    class: 'sync-toast',
    role: 'status',
    'aria-live': 'polite',
    text: syncToast.message ?? 'New lead received in cell',
  });
  setTimeout(() => {
    toast.hidden = true;
  }, 4000);
  return toast;
}

function renderPairingCard(controller) {
  const qrContainer = h('div', { class: 'pairing-card__qr' });
  const statusEl = h('p', { class: 'pairing-card__status', role: 'status', 'aria-live': 'polite' });
  const generateBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Pair Mobile Device' });

  let unsubscribe = () => {};

  function reset() {
    unsubscribe();
    unsubscribe = () => {};
    qrContainer.replaceChildren();
    statusEl.textContent = '';
  }

  generateBtn.addEventListener('click', async () => {
    reset();
    let pairingSessionId;
    let url;
    try {
      const baseUrl = `${window.location.origin}${window.location.pathname}`;
      ({ pairingSessionId, url } = controller.createPairingSession({ baseUrl }));
    } catch (error) {
      statusEl.textContent = error.message;
      return;
    }

    // Lowest supported error-correction level keeps the payload at the smallest QR
    // version for a given URL length, producing large, camera-friendly modules.
    const svgMarkup = await renderPairingQrSvg(url, { errorCorrectionLevel: 'L' });
    qrContainer.innerHTML = svgMarkup;
    statusEl.textContent = 'Waiting for a mobile device to scan...';

    unsubscribe = controller.subscribeToPairingConnected(pairingSessionId, () => {
      statusEl.textContent = 'Device connected! New submissions will appear below.';
    });
  });

  const card = h('div', { class: 'card pairing-card' }, [
    h('h3', { class: 'card__title', text: 'Pair Mobile Device' }),
    h('p', { class: 'card__meta', text: 'Generate a QR code for a customer to scan and submit their offer from their phone.' }),
    generateBtn,
    qrContainer,
    statusEl,
  ]);

  return card;
}

export function renderLeadInboxView(controller, { onSendCounter, tenantConfig, syncToast = null } = {}) {
  const list = h('div', { class: 'card-list' });
  const { overlay: documentModal, open: openDocumentModal } = renderDocumentModal();
  const { overlay: rejectionModal, open: openRejectionModal } = renderRejectionModal({
    onConfirm: (id, { rejectionReason, rejectionNotes }) => {
      controller.rejectLead(id, { rejectionReason, rejectionNotes });
      renderList();
    },
  });
  const sentMessageOverrides = new Map();
  let activeFilter = 'ACTIVE';

  const activeFilterBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Active Leads' });
  const closedFilterBtn = h('button', {
    class: 'button button--secondary',
    type: 'button',
    text: 'Passed / Closed Leads',
  });
  activeFilterBtn.addEventListener('click', () => {
    activeFilter = 'ACTIVE';
    renderList();
  });
  closedFilterBtn.addEventListener('click', () => {
    activeFilter = 'CLOSED';
    renderList();
  });
  const filterToggle = h('div', { class: 'card__actions filter-toggle' }, [activeFilterBtn, closedFilterBtn]);

  function renderList() {
    list.replaceChildren();
    activeFilterBtn.classList.toggle('button--active', activeFilter === 'ACTIVE');
    closedFilterBtn.classList.toggle('button--active', activeFilter === 'CLOSED');
    const leads = controller
      .buildLeadViewModels()
      .filter((lead) => (activeFilter === 'CLOSED' ? isPassedLead(lead.status) : !isPassedLead(lead.status)));

    if (leads.length === 0) {
      list.appendChild(
        h('p', {
          class: 'empty-state',
          text:
            activeFilter === 'CLOSED'
              ? 'No passed or closed leads yet.'
              : 'No submissions yet. Leads will appear here once sellers submit an offer.',
        }),
      );
      return;
    }

    leads.forEach((lead) => {
      const overrideMessage = sentMessageOverrides.get(lead.id);
      list.appendChild(
        renderLeadCard(overrideMessage ? { ...lead, counterMessage: overrideMessage } : lead, {
          onStatusChange: (id, status) => {
            controller.updateStatus(id, status);
            renderList();
          },
          onViewDocument: openDocumentModal,
          onApproveAndSend: (id, counterOfferAmount) => {
            const { message } = controller.approveAndSend(id, counterOfferAmount);
            sentMessageOverrides.set(id, message);
            renderList();
          },
          onRejectLead: (id) => openRejectionModal(id),
          onSendCounter: onSendCounter ?? (() => Promise.resolve({ shared: false })),
          onDownloadAppraisal: tenantConfig
            ? (id) =>
                downloadAppraisalSheet({
                  submission: controller.getSubmission(id),
                  tenantConfig,
                  verificationBaseUrl: `${window.location.origin}${window.location.pathname}`,
                })
            : null,
        }),
      );
    });
  }

  renderList();

  const section = h('section', { class: 'view', id: 'view-leads' }, [
    h('h2', { text: 'Lead Inbox' }),
    h('p', { class: 'view__subtitle', text: 'Submitted offers, scored against market comps.' }),
    renderPairingCard(controller),
    renderSyncToast(syncToast),
    filterToggle,
    list,
    documentModal,
    rejectionModal,
  ]);

  return { section, refresh: renderList };
}
