import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeDocument, findAll, findOne, byName, byTag } from './helpers/fakeDom.js';

globalThis.document = createFakeDocument();

const { renderSellerSubmissionView } = await import('../src/ui/SellerSubmissionView.js');

function stubController(overrides = {}) {
  return {
    submitSubmission: () => ({ submission: { id: 'sub-1' }, pendingSessionId: null }),
    getSubmission: () => null,
    bindPairingSession: () => null,
    ...overrides,
  };
}

function render(options = {}) {
  return renderSellerSubmissionView(stubController(), options);
}

test('the streamlined form exposes only the 3 mandatory pillars (VIN, mileage, offer document) plus optional ZIP at the top level', () => {
  const { section } = render();
  const form = findOne(section, byTag('form'));

  const topLevelInputNames = form.children
    .flatMap((row) => findAll(row, byTag('input')))
    .map((el) => el.getAttribute('name'))
    .filter(Boolean);

  assert.ok(topLevelInputNames.includes('vin'));
  assert.ok(topLevelInputNames.includes('mileage'));
  assert.ok(topLevelInputNames.includes('zipCode'));
  assert.ok(topLevelInputNames.includes('offerDocument'));
});

test('manual Year, Make, Model, and Trim inputs are removed from the default (collapsed) view', () => {
  const { section } = render();
  const detailsDrawer = findOne(section, byTag('details'));

  assert.ok(detailsDrawer, 'expected an Extracted Offer Details <details> drawer');
  assert.equal(detailsDrawer.hidden, true, 'the drawer should start hidden before any document is uploaded');

  for (const name of ['year', 'make', 'model', 'trim']) {
    const input = findOne(section, byName(name));
    assert.ok(input, `expected a ${name} input to still exist (inside the drawer, for editing extracted specs)`);
    assert.ok(
      [...findAll(detailsDrawer, byName(name))].includes(input),
      `expected the ${name} input to live inside the Extracted Offer Details drawer, not the top-level form`,
    );
  }
});

test('VIN is always required (the UOW-47 no-VIN ESTIMATE path is not reachable from this form anymore)', () => {
  const { section } = render();
  const vinInput = findOne(section, byName('vin'));
  assert.equal(vinInput.required, true);
});

test('ZIP Code is optional and the mileage field is labeled "Current Mileage"', () => {
  const { section } = render();
  const zipInput = findOne(section, byName('zipCode'));
  assert.equal(zipInput.required, false);

  const labels = findAll(section, byTag('label')).map((el) => el.textContent);
  assert.ok(labels.includes('ZIP Code (Optional)'));
  assert.ok(labels.includes('Current Mileage'));
});

test('the offer document dropzone is labeled per the streamlined copy and accepts images & PDFs', () => {
  const { section } = render();
  const fileInput = findOne(section, byName('offerDocument'));
  assert.equal(fileInput.required, true);
  assert.equal(fileInput.getAttribute('accept'), 'image/*,application/pdf');

  const dropzoneSpan = findOne(section, (el) => el.className?.includes('dropzone__label'));
  assert.match(dropzoneSpan.textContent, /Offer Document or Screenshot of Offer Document/);
});

test('the submit button starts disabled until all 3 pillars are present', () => {
  const { section } = render();
  const submitBtn = findOne(section, (el) => el.tagName === 'BUTTON' && el.getAttribute('type') === 'submit');
  assert.equal(submitBtn.disabled, true);
});
