import { h } from './App.js';
import { COMPETITORS } from '../models/Submission.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const APPROVAL_POLL_INTERVAL_MS = 3000;

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function renderSellerSubmissionView(controller, { sessionStashService = null, prefill = null } = {}) {
  const vinInput = h('input', { name: 'vin', placeholder: 'VIN', required: '', class: 'input--large' });
  const yearInput = h('input', {
    name: 'year',
    type: 'number',
    placeholder: 'Year',
    required: '',
    class: 'input--large',
  });
  const makeInput = h('input', { name: 'make', placeholder: 'Make', required: '', class: 'input--large' });
  const modelInput = h('input', { name: 'model', placeholder: 'Model', required: '', class: 'input--large' });
  const trimInput = h('input', { name: 'trim', placeholder: 'Trim (optional)', class: 'input--large' });
  const mileageInput = h('input', {
    name: 'mileage',
    type: 'number',
    placeholder: 'Mileage',
    min: '0',
    required: '',
    class: 'input--large',
  });
  const zipInput = h('input', { name: 'zipCode', placeholder: 'ZIP Code', required: '', class: 'input--large' });

  const competitorSelect = h(
    'select',
    { name: 'competitor', required: '', class: 'input--large' },
    COMPETITORS.map((competitor) => h('option', { value: competitor, text: competitor })),
  );
  const dealerNameInput = h('input', {
    name: 'competitorDealerName',
    placeholder: 'Competitor Dealer Name',
    class: 'input--large',
  });
  const dealerNameRow = h('div', { class: 'form__row', hidden: '' }, [
    h('label', { text: 'Competitor Dealer Name' }),
    dealerNameInput,
  ]);

  competitorSelect.addEventListener('change', () => {
    const isOther = competitorSelect.value === 'Other';
    dealerNameRow.hidden = !isOther;
    dealerNameInput.required = isOther;
  });

  const offerAmountInput = h('input', {
    name: 'competitorOfferAmount',
    type: 'number',
    placeholder: 'Competitor Offer Amount ($)',
    min: '0',
    required: '',
    class: 'input--large',
  });

  const fileInput = h('input', {
    type: 'file',
    name: 'offerDocument',
    accept: 'image/*,application/pdf',
    capture: 'environment',
    class: 'dropzone__input',
  });
  const dropzoneLabel = h('span', { class: 'dropzone__label', text: 'Tap to take a photo or drop a PDF' });
  const dropzone = h('label', { class: 'dropzone' }, [fileInput, dropzoneLabel]);

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('dropzone--active');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dropzone--active'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('dropzone--active');
    if (event.dataTransfer?.files?.length) {
      fileInput.files = event.dataTransfer.files;
    }
  });
  fileInput.addEventListener('change', () => {
    dropzoneLabel.textContent = fileInput.files?.[0]?.name ?? 'Tap to take a photo or drop a PDF';
  });

  const statusEl = h('p', { class: 'form__status', role: 'status', 'aria-live': 'polite' });
  const submitBtn = h('button', { class: 'button button--large', type: 'submit', text: 'Submit for Review' });

  const waitingSpinner = h('div', { class: 'waiting-screen__spinner', 'aria-hidden': 'true' });
  const waitingMessageEl = h('p', {
    class: 'waiting-screen__message',
    role: 'status',
    'aria-live': 'polite',
    text: 'Evaluating Your Offer...',
  });
  const waitingScreen = h('div', { class: 'waiting-screen', hidden: '' }, [waitingSpinner, waitingMessageEl]);

  function startWaitingForApproval(pendingSessionId) {
    form.hidden = true;
    waitingScreen.hidden = false;
    waitingSpinner.hidden = false;
    waitingMessageEl.textContent = 'Evaluating Your Offer...';

    if (!sessionStashService) return;

    let settled = false;
    const unsubscribe = sessionStashService.subscribe(pendingSessionId, resolve);
    const intervalId = setInterval(() => {
      const status = sessionStashService.getStatus(pendingSessionId);
      if (status?.status === 'READY') resolve(status);
    }, APPROVAL_POLL_INTERVAL_MS);

    function resolve(entry) {
      if (settled) return;
      settled = true;
      clearInterval(intervalId);
      unsubscribe();
      waitingSpinner.hidden = true;
      waitingMessageEl.textContent = `Offer Ready! We can pay you ${currencyFormatter.format(entry.finalCounterOffer)} today.`;
    }
  }

  const form = h('form', { class: 'form form--mobile' }, [
    h('div', { class: 'form__row' }, [h('label', { text: 'VIN' }), vinInput]),
    h('div', { class: 'form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Year' }), yearInput]),
      h('div', {}, [h('label', { text: 'Make' }), makeInput]),
    ]),
    h('div', { class: 'form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Model' }), modelInput]),
      h('div', {}, [h('label', { text: 'Trim' }), trimInput]),
    ]),
    h('div', { class: 'form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Mileage' }), mileageInput]),
      h('div', {}, [h('label', { text: 'ZIP Code' }), zipInput]),
    ]),
    h('div', { class: 'form__row' }, [h('label', { text: 'Competitor' }), competitorSelect]),
    dealerNameRow,
    h('div', { class: 'form__row' }, [h('label', { text: 'Competitor Offer Amount' }), offerAmountInput]),
    h('div', { class: 'form__row' }, [h('label', { text: 'Offer Document' }), dropzone]),
    submitBtn,
    statusEl,
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusEl.textContent = '';
    submitBtn.disabled = true;

    try {
      const file = fileInput.files?.[0] ?? null;
      const offerDocument = file ? await readFileAsBase64(file) : null;
      const data = new FormData(form);

      const { pendingSessionId } = controller.submitSubmission({
        vin: data.get('vin'),
        year: Number(data.get('year')),
        make: data.get('make'),
        model: data.get('model'),
        trim: data.get('trim') || null,
        mileage: Number(data.get('mileage')),
        zipCode: data.get('zipCode'),
        competitor: data.get('competitor'),
        competitorDealerName: data.get('competitorDealerName') || null,
        competitorOfferAmount: Number(data.get('competitorOfferAmount')),
        offerDocument,
      });

      form.reset();
      dealerNameRow.hidden = true;
      dropzoneLabel.textContent = 'Tap to take a photo or drop a PDF';
      statusEl.textContent = "Submitted! We'll let you know if we can beat that offer.";
      statusEl.classList.remove('form__status--error');

      if (pendingSessionId) {
        startWaitingForApproval(pendingSessionId);
      }
    } catch (error) {
      statusEl.textContent = error.message;
      statusEl.classList.add('form__status--error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  if (prefill) {
    vinInput.value = prefill.vin ?? '';
    yearInput.value = prefill.year ?? '';
    makeInput.value = prefill.make ?? '';
    modelInput.value = prefill.model ?? '';
    trimInput.value = prefill.trim ?? '';
    mileageInput.value = prefill.mileage ?? '';
    zipInput.value = prefill.zipCode ?? '';
    if (prefill.competitor) {
      competitorSelect.value = prefill.competitor;
    }
    const isOther = competitorSelect.value === 'Other';
    dealerNameRow.hidden = !isOther;
    dealerNameInput.required = isOther;
    dealerNameInput.value = prefill.competitorDealerName ?? '';
    offerAmountInput.value = prefill.competitorOfferAmount ?? '';
  }

  return h('section', { class: 'view', id: 'view-sell' }, [
    h('h2', { text: 'Sell Your Car' }),
    h('p', { class: 'view__subtitle', text: 'Got a better offer elsewhere? Show us and we may beat it.' }),
    form,
    waitingScreen,
  ]);
}
