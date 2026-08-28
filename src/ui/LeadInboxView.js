import { h } from './App.js';
import { downloadAppraisalSheet } from '../utils/appraisalPdfGenerator.js';

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

function spreadBadge(status) {
  const className = `badge badge--${status.toLowerCase().replace('_', '-')}`;
  return { label: BADGE_LABELS[status] ?? BADGE_LABELS.NO_DATA, className };
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

function renderLeadCard(lead, { onStatusChange, onViewDocument, onApproveAndSend, onSendCounter, onDownloadAppraisal }) {
  const badge = spreadBadge(lead.spreadResult.status);
  const dispatchBadge = DISPATCH_BADGES[lead.status];

  const top = h('div', { class: 'card__top' }, [
    h('h3', { class: 'card__title', text: lead.vehicleTitle }),
    h('span', { class: badge.className, text: badge.label }),
    dispatchBadge ? h('span', { class: dispatchBadge.className, text: dispatchBadge.label }) : null,
  ]);

  const meta = h('div', { class: 'card__meta' }, [
    h('span', { text: `${mileageFormatter.format(lead.mileage)} mi` }),
    h('span', { text: `ZIP ${lead.zipCode}` }),
    h('span', { text: lead.competitorLabel }),
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

  if (lead.status === 'PENDING_APPROVAL') {
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
    actions.appendChild(counterInput);
    actions.appendChild(modifyBtn);
    actions.appendChild(approveBtn);
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

export function renderLeadInboxView(controller, { onSendCounter, tenantConfig, syncToast = null } = {}) {
  const list = h('div', { class: 'card-list' });
  const { overlay: documentModal, open: openDocumentModal } = renderDocumentModal();
  const sentMessageOverrides = new Map();

  function renderList() {
    list.replaceChildren();
    const leads = controller.buildLeadViewModels();

    if (leads.length === 0) {
      list.appendChild(
        h('p', {
          class: 'empty-state',
          text: 'No submissions yet. Leads will appear here once sellers submit an offer.',
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
    renderSyncToast(syncToast),
    list,
    documentModal,
  ]);

  return { section, refresh: renderList };
}
