import { marketVerdictBadge } from './marketBadge.js';
import { deriveVehicleCondition } from './vehicleCard.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const mileageFormatter = new Intl.NumberFormat('en-US');

function el(tag, className, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function buildResultCard({ vehicle, dealer, evaluation }, onSelect) {
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle';
  const priceLabel = currencyFormatter.format(vehicle.price);
  const mileageLabel = vehicle.mileage !== null ? `${mileageFormatter.format(vehicle.mileage)} mi` : 'Mileage unavailable';
  const badge = marketVerdictBadge(evaluation?.verdict ?? null);

  const top = el('div', 'chat-discovery__card-top', [
    el('h4', 'chat-discovery__card-title', title),
    el('span', `${badge.className} chat-discovery__card-badge`, badge.label),
  ]);

  const meta = el('div', 'chat-discovery__card-meta', [
    el('span', 'chat-discovery__card-price', priceLabel),
    el('span', null, mileageLabel),
    el('span', null, deriveVehicleCondition(vehicle)),
    dealer ? el('span', null, dealer.name) : null,
  ]);

  const card = el('button', 'chat-discovery__card', [top, meta]);
  card.type = 'button';
  card.addEventListener('click', () => onSelect?.({ vehicle, dealer, evaluation }));
  return card;
}

/**
 * Renders the floating conversational discovery bar overlaying the map footer, plus the rich
 * results drawer for Top-5 matches. Query parsing/filtering/ranking happens upstream; this
 * component just collects input text and renders whatever results it is given.
 */
export function renderChatDiscovery({ onSubmit, onSelectResult } = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chat-discovery__input';
  input.placeholder = 'Looking for an SUV under $30k with low miles...';
  input.setAttribute('aria-label', 'Describe the vehicle you want');

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'chat-discovery__submit';
  submitBtn.textContent = 'Search';

  const form = document.createElement('form');
  form.className = 'chat-discovery__bar';
  form.append(input, submitBtn);

  const resultsHeader = el('h3', 'chat-discovery__results-title', 'Top Matches');
  const resultsClose = document.createElement('button');
  resultsClose.type = 'button';
  resultsClose.className = 'chat-discovery__close';
  resultsClose.textContent = 'Close';
  const resultsSummary = el('p', 'chat-discovery__results-summary');
  resultsSummary.hidden = true;
  const resultsList = el('div', 'chat-discovery__results-list');
  const resultsDrawer = el('div', 'chat-discovery__results', [
    el('div', 'chat-discovery__results-header', [resultsHeader, resultsClose]),
    resultsSummary,
    resultsList,
  ]);
  resultsDrawer.hidden = true;
  resultsClose.addEventListener('click', () => {
    resultsDrawer.hidden = true;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    submitBtn.disabled = true;
    try {
      await onSubmit?.(text);
    } finally {
      submitBtn.disabled = false;
    }
  });

  const element = document.createDocumentFragment();
  element.append(form, resultsDrawer);

  return {
    element,
    showResults(matches, intentSummary) {
      resultsSummary.textContent = intentSummary ?? '';
      resultsSummary.hidden = !intentSummary;

      resultsList.replaceChildren();
      if (matches.length === 0) {
        resultsList.append(el('p', 'chat-discovery__empty', 'No matches found. Try a different search.'));
      } else {
        matches.forEach((match) => resultsList.append(buildResultCard(match, onSelectResult)));
      }
      resultsDrawer.hidden = false;
    },
    hideResults() {
      resultsDrawer.hidden = true;
    },
  };
}
