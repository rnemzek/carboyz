import { h } from './App.js';
import { COMPETITORS } from '../models/Submission.js';
import { downloadAppraisalSheet } from '../utils/appraisalPdfGenerator.js';
import { createVinScanner, findValidVin, validateVin } from '../utils/vinScanner.js';
import { requestOfferParse, mapExtractedOfferToFormValues } from './offerAutoPopulate.js';
import { resolveVehicleFromVin } from '../services/nhtsaVinDecoder.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const APPROVAL_POLL_INTERVAL_MS = 3000;

function renderVinScannerModal({ onVinConfirmed }) {
  const video = h('video', { class: 'scanner-modal__video', autoplay: '', muted: '', playsinline: '' });
  const reticle = h('div', { class: 'scanner-modal__reticle', 'aria-hidden': 'true' });
  const viewport = h('div', { class: 'scanner-modal__viewport' }, [video, reticle]);
  const statusEl = h('p', { class: 'scanner-modal__status', role: 'status', 'aria-live': 'polite' });
  const manualInput = h('input', { class: 'input--large', placeholder: 'Or type/paste the VIN' });
  const useTypedBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Use This VIN' });
  const fallbackRow = h('div', { class: 'scanner-modal__fallback' }, [manualInput, useTypedBtn]);
  const cancelBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Cancel' });
  const actions = h('div', { class: 'scanner-modal__actions' }, [cancelBtn]);
  const modal = h('div', { class: 'modal scanner-modal' }, [
    h('h3', { class: 'modal__stage', text: 'Scan VIN' }),
    viewport,
    statusEl,
    fallbackRow,
    actions,
  ]);
  const overlay = h('div', { class: 'modal-overlay', hidden: '' }, [modal]);

  let scanner = null;

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle('scanner-modal__status--error', isError);
  }

  function stopScanner() {
    scanner?.stop();
    scanner = null;
  }

  function close() {
    stopScanner();
    overlay.hidden = true;
    manualInput.value = '';
  }

  function confirm(vin) {
    stopScanner();
    overlay.hidden = true;
    manualInput.value = '';
    onVinConfirmed(vin);
  }

  function handleError({ reason }) {
    if (reason === 'unsupported') {
      setStatus('Camera not available on this device — type or paste the VIN below.', true);
    } else if (reason === 'permission-denied') {
      setStatus('Camera access denied — type or paste the VIN below.', true);
    } else {
      setStatus('Having trouble reading that — try lining up the barcode, or type the VIN below.', true);
    }
  }

  function open() {
    overlay.hidden = false;
    setStatus('Point the camera at the door-jamb barcode or VIN.');
    scanner = createVinScanner({
      videoElement: video,
      onDetected: ({ vin }) => confirm(vin),
      onError: handleError,
    });
    scanner.start();
  }

  useTypedBtn.addEventListener('click', () => {
    const vin = findValidVin(manualInput.value);
    if (!vin) {
      setStatus("Couldn't find a valid VIN in that text — double check and try again.", true);
      return;
    }
    confirm(vin);
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  return { overlay, open, close };
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readPairingSessionIdFromLocation() {
  if (typeof window === 'undefined' || !window.location?.search) {
    return null;
  }
  return new URLSearchParams(window.location.search).get('sessionId');
}

export function renderSellerSubmissionView(controller, { sessionStashService = null, prefill = null, tenantConfig = null } = {}) {
  controller.bindPairingSession?.(readPairingSessionIdFromLocation());

  // Provenance of the *competitor's offer* currently populating the form — ESTIMATE (parsed from
  // a VIN-less "Estimate" screenshot) vs FIRM_OFFER (manual entry, or parsed from a real written
  // offer document). This tracks where the competitor number came from, not whether the VIN field
  // is filled in: the seller supplying a VIN themselves doesn't retroactively make Carvana's (or
  // similar) estimate a firm offer, so only applyExtractedOffer() below ever changes this. See
  // Submission.OFFER_SOURCE_TYPES. UOW-51 streamlines the live form to always require a VIN
  // before submit — the no-VIN preliminary-counter path (UOW-47) stays intact at the model/
  // dispatch layer for other intake channels, it's just never reachable from this form anymore.
  let offerSourceType = 'FIRM_OFFER';

  const vinInput = h('input', {
    name: 'vin',
    placeholder: 'VIN',
    maxlength: '17',
    required: '',
    class: 'input--large sell-form__vin-input',
  });
  const scanVinBtn = h('button', { class: 'button button--secondary', type: 'button', text: '📷 Scan VIN' });
  const vinHelperEl = h('p', { class: 'sell-form__vin-helper', role: 'status', 'aria-live': 'polite', hidden: '' });

  let lastDecodedVin = null;

  // Best-effort NHTSA vPIC lookup to auto-populate year/make/model/trim now that the form no
  // longer collects them manually — never blocks the seller; a failed/unlisted decode just
  // leaves those fields null for desk review to fill in later (see nhtsaVinDecoder.js).
  async function decodeVinIfValid(vin) {
    if (!validateVin(vin) || vin === lastDecodedVin) {
      return;
    }
    lastDecodedVin = vin;
    const decoded = await resolveVehicleFromVin(vin);
    if (decoded.vin !== lastDecodedVin) {
      return; // a newer VIN superseded this lookup while it was in flight
    }
    if (decoded.year != null && !yearInput.value) yearInput.value = decoded.year;
    if (decoded.make && !makeInput.value) makeInput.value = decoded.make;
    if (decoded.model && !modelInput.value) modelInput.value = decoded.model;
    if (decoded.trim && !trimInput.value) trimInput.value = decoded.trim;
    openDetailsDrawer();
  }

  const vinScannerModal = renderVinScannerModal({
    onVinConfirmed: (vin) => {
      controller.hapticsService?.vibrate?.();
      vinInput.value = vin;
      vinHelperEl.hidden = true;
      decodeVinIfValid(vin);
      updateSubmitState();
    },
  });
  scanVinBtn.addEventListener('click', () => vinScannerModal.open());
  // Once the seller supplies a VIN themselves (typed, pasted, or scanned), the earlier
  // "Estimate detected" guidance has served its purpose — but offerSourceType stays ESTIMATE,
  // since the competitor's own number is still just their estimate, not a firm written offer.
  // Submitting with that VIN now upgrades the eventual counter from the conservative no-VIN
  // bump to the full verified-VIN tier (see SpreadService.calculateSpread).
  vinInput.addEventListener('input', () => {
    if (vinInput.value.trim()) {
      vinHelperEl.hidden = true;
    }
    const candidate = findValidVin(vinInput.value);
    if (candidate) decodeVinIfValid(candidate);
    updateSubmitState();
  });
  const yearInput = h('input', { name: 'year', type: 'number', placeholder: 'Year', class: 'input--large sell-form__year-input' });
  const makeInput = h('input', { name: 'make', placeholder: 'Make', class: 'input--large' });
  const modelInput = h('input', { name: 'model', placeholder: 'Model', class: 'input--large' });
  const trimInput = h('input', { name: 'trim', placeholder: 'Trim (optional)', class: 'input--large' });
  const mileageInput = h('input', {
    name: 'mileage',
    type: 'number',
    placeholder: 'Current Mileage',
    min: '0',
    required: '',
    class: 'input--large',
  });
  const mileageField = h('div', { class: 'sell-form__unit-field sell-form__unit-field--suffix' }, [
    mileageInput,
    h('span', { class: 'sell-form__unit', 'aria-hidden': 'true', text: 'mi' }),
  ]);
  mileageInput.addEventListener('input', updateSubmitState);
  // UOW-51: zipCode is no longer one of the 3 mandatory pillars — relaxed to optional on
  // Submission.js, so it's explicitly labeled as such here too.
  const zipInput = h('input', { name: 'zipCode', placeholder: 'ZIP Code (Optional)', class: 'input--large' });

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
    placeholder: 'Competitor Offer Amount',
    min: '0',
    required: '',
    class: 'input--large',
  });
  const offerAmountField = h('div', { class: 'sell-form__unit-field sell-form__unit-field--prefix' }, [
    h('span', { class: 'sell-form__unit', 'aria-hidden': 'true', text: '$' }),
    offerAmountInput,
  ]);

  const DROPZONE_DEFAULT_LABEL = 'Offer Document or Screenshot of Offer Document (accepts images & PDFs)';
  const fileInput = h('input', {
    type: 'file',
    name: 'offerDocument',
    accept: 'image/*,application/pdf',
    capture: 'environment',
    required: '',
    class: 'dropzone__input',
  });
  const dropzoneLabel = h('span', { class: 'dropzone__label', text: DROPZONE_DEFAULT_LABEL });
  const dropzone = h('label', { class: 'dropzone' }, [fileInput, dropzoneLabel]);

  let pendingOfferDocumentBase64 = null;

  function applyExtractedOffer({ success, extracted } = {}) {
    if (!success) return;
    const values = mapExtractedOfferToFormValues(extracted ?? {});

    if (values.vin) {
      vinInput.value = values.vin;
      decodeVinIfValid(values.vin);
    }
    if (values.year != null) yearInput.value = values.year;
    if (values.make) makeInput.value = values.make;
    if (values.model) modelInput.value = values.model;
    if (values.mileage != null) mileageInput.value = values.mileage;
    if (values.competitorOfferAmount != null) offerAmountInput.value = values.competitorOfferAmount;

    if (values.competitor) {
      competitorSelect.value = values.competitor;
      dealerNameRow.hidden = true;
      dealerNameInput.required = false;
    } else if (values.competitorDealerName) {
      competitorSelect.value = 'Other';
      dealerNameInput.value = values.competitorDealerName;
      dealerNameRow.hidden = false;
      dealerNameInput.required = true;
    }

    // Competitor "Estimate" screens (e.g. Carvana's instant online quote) deliberately omit the
    // VIN to avoid lead spam, so this is the expected shape for an image-sourced parse, not a
    // failure — guide the seller straight to supplying the one field the estimate couldn't have.
    // UOW-51: the live form always requires a VIN before submit now, so the guidance no longer
    // offers a no-VIN "submit now for a preliminary offer" path — only the real UOW-47 model/
    // dispatch capability is still reachable from other intake channels.
    if (values.isEstimate && !values.vin) {
      vinHelperEl.textContent = 'Estimate detected — enter your VIN or scan the barcode to continue.';
      vinHelperEl.hidden = false;
      offerSourceType = 'ESTIMATE';
      vinInput.focus();
    } else {
      vinHelperEl.hidden = true;
      vinHelperEl.textContent = '';
      offerSourceType = 'FIRM_OFFER';
    }
    openDetailsDrawer();
    updateSubmitState();
  }

  // Auto-population is best-effort: a parse failure (network down, low-confidence document)
  // leaves the dropzone upload intact and the "Extracted Offer Details" drawer open for manual entry.
  async function handleFileSelected(file) {
    dropzoneLabel.textContent = file?.name ?? DROPZONE_DEFAULT_LABEL;
    pendingOfferDocumentBase64 = null;
    if (!file) {
      updateSubmitState();
      return;
    }

    try {
      pendingOfferDocumentBase64 = await readFileAsBase64(file);
    } catch {
      updateSubmitState();
      return;
    }

    openDetailsDrawer();
    updateSubmitState();

    try {
      const result = await requestOfferParse({ documentBase64: pendingOfferDocumentBase64, mimeType: file.type });
      applyExtractedOffer(result);
    } catch {
      // Leave the drawer open for manual entry.
    }
  }

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
      handleFileSelected(fileInput.files[0]);
    }
  });
  fileInput.addEventListener('change', () => {
    handleFileSelected(fileInput.files?.[0] ?? null);
  });

  const statusEl = h('p', { class: 'form__status', role: 'status', 'aria-live': 'polite' });
  const submitBtn = h('button', { class: 'button button--large', type: 'submit', text: 'Submit for Review' });

  // The 3 mandatory pillars (UOW-51): VIN, mileage, and the offer document. Disabled (with a
  // short warning) until all three are present, rather than letting the seller hit submit and
  // bounce off a server-side validation error.
  function hasThreePillars() {
    return Boolean(findValidVin(vinInput.value)) && Number(mileageInput.value) > 0 && Boolean(pendingOfferDocumentBase64 || fileInput.files?.[0]);
  }

  const pillarHintEl = h('p', { class: 'sell-form__pillar-hint', role: 'status', 'aria-live': 'polite' });

  function updateSubmitState() {
    const ready = hasThreePillars();
    submitBtn.disabled = !ready;
    pillarHintEl.textContent = ready ? '' : 'Add your VIN, current mileage, and offer document/screenshot to continue.';
  }

  // Compact, collapsible review of everything the offer document / VIN decode extracted —
  // appears once a document is uploaded, pre-filled and editable before the seller submits.
  const detailsDrawer = h('details', { class: 'sell-form__details-drawer', hidden: '' }, [
    h('summary', { class: 'sell-form__details-summary', text: 'Extracted Offer Details' }),
    h('div', { class: 'form__row' }, [h('label', { text: 'Competitor' }), competitorSelect]),
    dealerNameRow,
    h('div', { class: 'form__row' }, [h('label', { text: 'Competitor Offer Amount' }), offerAmountField]),
    h('div', { class: 'form__row--split sell-form__vehicle-grid' }, [
      h('div', { class: 'form__row' }, [h('label', { text: 'Year' }), yearInput]),
      h('div', { class: 'form__row' }, [h('label', { text: 'Make' }), makeInput]),
      h('div', { class: 'form__row' }, [h('label', { text: 'Model' }), modelInput]),
      h('div', { class: 'form__row' }, [h('label', { text: 'Trim' }), trimInput]),
    ]),
  ]);
  function openDetailsDrawer() {
    detailsDrawer.hidden = false;
    detailsDrawer.open = true;
  }

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

      const submission = tenantConfig ? controller.getSubmission(entry.submissionId) : null;
      if (submission) {
        const downloadBtn = h('button', { class: 'button', type: 'button', text: 'Download Guaranteed Offer Sheet' });
        downloadBtn.addEventListener('click', () => {
          downloadAppraisalSheet({
            submission,
            tenantConfig,
            verificationBaseUrl: `${window.location.origin}${window.location.pathname}`,
          });
        });
        waitingScreen.appendChild(downloadBtn);
      }
    }
  }

  const form = h('form', { class: 'form form--mobile sell-form' }, [
    h('div', { class: 'form__row' }, [h('label', { text: 'Offer Document or Screenshot of Offer Document' }), dropzone]),
    h('div', { class: 'form__row' }, [
      h('label', { text: 'VIN' }),
      h('div', { class: 'vin-input-row' }, [vinInput, scanVinBtn]),
      vinHelperEl,
    ]),
    h('div', { class: 'form__row' }, [h('label', { text: 'Current Mileage' }), mileageField]),
    h('div', { class: 'form__row' }, [h('label', { text: 'ZIP Code (Optional)' }), zipInput]),
    detailsDrawer,
    pillarHintEl,
    submitBtn,
    statusEl,
  ]);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusEl.textContent = '';
    submitBtn.disabled = true;

    try {
      const file = fileInput.files?.[0] ?? null;
      const offerDocument = pendingOfferDocumentBase64 ?? (file ? await readFileAsBase64(file) : null);
      const data = new FormData(form);

      const { pendingSessionId } = controller.submitSubmission({
        vin: data.get('vin'),
        year: data.get('year') ? Number(data.get('year')) : null,
        make: data.get('make') || null,
        model: data.get('model') || null,
        trim: data.get('trim') || null,
        mileage: Number(data.get('mileage')),
        zipCode: data.get('zipCode') || null,
        competitor: data.get('competitor'),
        competitorDealerName: data.get('competitorDealerName') || null,
        competitorOfferAmount: Number(data.get('competitorOfferAmount')),
        offerDocument,
        offerSourceType,
      });

      form.reset();
      dealerNameRow.hidden = true;
      dropzoneLabel.textContent = DROPZONE_DEFAULT_LABEL;
      pendingOfferDocumentBase64 = null;
      lastDecodedVin = null;
      offerSourceType = 'FIRM_OFFER';
      detailsDrawer.hidden = true;
      detailsDrawer.open = false;
      vinHelperEl.hidden = true;
      vinHelperEl.textContent = '';
      statusEl.textContent = "Submitted! We'll let you know if we can beat that offer.";
      statusEl.classList.remove('form__status--error');

      if (pendingSessionId) {
        startWaitingForApproval(pendingSessionId);
      }
    } catch (error) {
      statusEl.textContent = error.message;
      statusEl.classList.add('form__status--error');
    } finally {
      updateSubmitState();
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

  function setInputValue(input, value) {
    if (value === null || value === undefined) return;
    input.value = value;
    // Dispatched (not just `.value` set) so any downstream listener bound to this input — e.g. a
    // future validation/spread-preview hook — reacts the same way it would to a real keystroke.
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** Populates VIN + vehicle metadata from an external source (the dev Test Bed drawer's preset picker). */
  function applyVehicle({ vin, year, make, model, trim, mileage } = {}) {
    setInputValue(vinInput, vin);
    setInputValue(yearInput, year);
    setInputValue(makeInput, make);
    setInputValue(modelInput, model);
    setInputValue(trimInput, trim);
    setInputValue(mileageInput, mileage);
    updateSubmitState();
  }

  updateSubmitState();

  const section = h('section', { class: 'view', id: 'view-sell' }, [
    h('h2', { text: 'Sell Your Car' }),
    h('p', { class: 'view__subtitle', text: 'Got a better offer elsewhere? Show us and we may beat it.' }),
    form,
    waitingScreen,
    vinScannerModal.overlay,
  ]);

  return { section, applyVehicle };
}
