import { encodeQrMatrix, renderQrSvg } from './qrEncoder.js';

export const EXPIRATION_WINDOW_DAYS = 7;
export const MILE_ALLOWANCE_MILES = 250;
export const DOCUMENT_WIDTH = 816;
export const DOCUMENT_HEIGHT = 1056;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const mileageFormatter = new Intl.NumberFormat('en-US');
const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

function competitorName(submission) {
  if (submission.competitor === 'Other' && submission.competitorDealerName) {
    return submission.competitorDealerName;
  }
  return submission.competitor;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dealer';
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function brandInitials(name = '') {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const [firstWord] = trimmed.split(/\s+/);
  return firstWord.slice(0, 2).toUpperCase();
}

/** Deep-links back into this zero-backend PWA (submissions are tenant-scoped localStorage). */
export function buildVerificationUrl(baseUrl, submission) {
  return `${baseUrl ?? ''}?tab=sell&sid=${encodeURIComponent(submission.id)}`;
}

/**
 * Pure orchestrator: assembles every formatted string/number the SVG renderer needs.
 * Throws if the caller's contract is violated (missing submission/tenantConfig/finalCounterOffer) —
 * callers only ever invoke this for an already-dispatched lead, so these are caller bugs, not
 * runtime states to handle gracefully.
 */
export function buildAppraisalPayload({ submission, tenantConfig, verificationBaseUrl = '', now = new Date() } = {}) {
  if (!submission) {
    throw new Error('buildAppraisalPayload requires a submission');
  }
  if (!tenantConfig) {
    throw new Error('buildAppraisalPayload requires a tenantConfig');
  }
  if (submission.finalCounterOffer === null || submission.finalCounterOffer === undefined) {
    throw new Error('buildAppraisalPayload requires a submission with a finalCounterOffer');
  }

  const originalOfferAmount = submission.initialCompetitorOffer ?? submission.competitorOfferAmount;
  const guaranteedCounterOfferAmount = submission.finalCounterOffer;
  const spreadOffsetAmount = guaranteedCounterOfferAmount - originalOfferAmount;
  const expiresAt = new Date(now.getTime() + EXPIRATION_WINDOW_DAYS * MS_PER_DAY);
  const expiresAtLabel = dateFormatter.format(expiresAt);

  return {
    tenant: {
      name: tenantConfig.name,
      logoUrl: tenantConfig.logoUrl || '',
      accentColor: tenantConfig.themeColors?.accent || tenantConfig.themeColors?.primary || '#0057D9',
      contactPhone: tenantConfig.contact?.phone || '',
      contactEmail: tenantConfig.contact?.email || '',
    },
    title: 'Official Counter-Offer Appraisal',
    generatedAtLabel: dateFormatter.format(now),
    expiresAtLabel,
    vehicle: {
      titleLine: [submission.year, submission.make, submission.model, submission.trim].filter(Boolean).join(' '),
      year: submission.year,
      make: submission.make,
      model: submission.model,
      trim: submission.trim ?? null,
      mileageLabel: `${mileageFormatter.format(submission.mileage)} mi`,
      vin: submission.vin,
    },
    competitor: {
      name: competitorName(submission),
      originalOfferAmount,
      spreadOffsetAmount,
      guaranteedCounterOfferAmount,
      originalOfferLabel: currencyFormatter.format(originalOfferAmount),
      spreadOffsetLabel: `${spreadOffsetAmount >= 0 ? '+' : '-'}${currencyFormatter.format(Math.abs(spreadOffsetAmount))}`,
      guaranteedCounterOfferLabel: currencyFormatter.format(guaranteedCounterOfferAmount),
    },
    verificationUrl: buildVerificationUrl(verificationBaseUrl, submission),
    mileAllowanceMiles: MILE_ALLOWANCE_MILES,
    disclaimers: [
      `This guaranteed counter-offer is valid for ${EXPIRATION_WINDOW_DAYS} days from the date of issue, expiring ${expiresAtLabel}.`,
      `Offer amount assumes the vehicle's mileage is within ${MILE_ALLOWANCE_MILES} miles of the mileage stated above at the time of inspection.`,
      `Final payout is subject to an in-person ${tenantConfig.name} inspection confirming the vehicle's condition and title status.`,
    ],
  };
}

export function buildAppraisalFilename(payload) {
  return `${slugify(payload.tenant.name)}-appraisal-${slugify(payload.vehicle.vin)}.svg`;
}

function renderHeader(payload) {
  const logo = payload.tenant.logoUrl
    ? `<image href="${escapeXml(payload.tenant.logoUrl)}" x="48" y="40" width="72" height="72" preserveAspectRatio="xMidYMid meet"/>`
    : `<circle cx="84" cy="76" r="36" fill="${escapeXml(payload.tenant.accentColor)}"/>` +
      `<text x="84" y="86" font-size="28" font-family="sans-serif" fill="#ffffff" text-anchor="middle">${escapeXml(brandInitials(payload.tenant.name))}</text>`;

  const contact = [payload.tenant.contactPhone, payload.tenant.contactEmail].filter(Boolean).join('  •  ');

  return (
    `${logo}` +
    `<text x="140" y="64" font-size="26" font-family="sans-serif" font-weight="bold" fill="#111318">${escapeXml(payload.tenant.name)}</text>` +
    (contact
      ? `<text x="140" y="88" font-size="13" font-family="sans-serif" fill="#444444">${escapeXml(contact)}</text>`
      : '') +
    `<text x="140" y="112" font-size="15" font-family="sans-serif" fill="${escapeXml(payload.tenant.accentColor)}">${escapeXml(payload.title)}</text>` +
    `<rect x="48" y="132" width="${DOCUMENT_WIDTH - 96}" height="3" fill="${escapeXml(payload.tenant.accentColor)}"/>`
  );
}

function renderVehicleSummary(payload) {
  const rows = [
    ['Year', String(payload.vehicle.year)],
    ['Make', payload.vehicle.make],
    ['Model', payload.vehicle.model],
    ['Trim', payload.vehicle.trim ?? '—'],
    ['Mileage', payload.vehicle.mileageLabel],
  ];
  const rowMarkup = rows
    .map(
      ([label, value], index) =>
        `<text x="48" y="${210 + index * 26}" font-size="13" font-family="sans-serif" fill="#666666">${escapeXml(label)}</text>` +
        `<text x="180" y="${210 + index * 26}" font-size="13" font-family="sans-serif" fill="#111318">${escapeXml(value)}</text>`,
    )
    .join('');

  return (
    `<text x="48" y="176" font-size="16" font-family="sans-serif" font-weight="bold" fill="#111318">Vehicle Summary</text>` +
    rowMarkup +
    `<text x="48" y="${210 + rows.length * 26}" font-size="13" font-family="sans-serif" fill="#666666">VIN</text>` +
    `<text x="180" y="${210 + rows.length * 26}" font-size="16" font-family="monospace" letter-spacing="1" fill="#111318">${escapeXml(payload.vehicle.vin)}</text>`
  );
}

function renderCompetitorComparison(payload) {
  const boxY = 400;
  const boxHeight = 170;
  return (
    `<rect x="48" y="${boxY}" width="${DOCUMENT_WIDTH - 96}" height="${boxHeight}" rx="8" fill="#ffffff" stroke="${escapeXml(payload.tenant.accentColor)}" stroke-width="2"/>` +
    `<text x="68" y="${boxY + 32}" font-size="16" font-family="sans-serif" font-weight="bold" fill="#111318">Competitor Comparison</text>` +
    `<text x="68" y="${boxY + 62}" font-size="13" font-family="sans-serif" fill="#666666">Competitor</text>` +
    `<text x="68" y="${boxY + 82}" font-size="15" font-family="sans-serif" fill="#111318">${escapeXml(payload.competitor.name)}</text>` +
    `<text x="68" y="${boxY + 112}" font-size="13" font-family="sans-serif" fill="#666666">Original Competitor Offer</text>` +
    `<text x="68" y="${boxY + 132}" font-size="15" font-family="sans-serif" fill="#111318">${escapeXml(payload.competitor.originalOfferLabel)}</text>` +
    `<text x="330" y="${boxY + 112}" font-size="13" font-family="sans-serif" fill="#666666">CarBoyZ Spread Offset</text>` +
    `<text x="330" y="${boxY + 132}" font-size="15" font-family="sans-serif" fill="#111318">${escapeXml(payload.competitor.spreadOffsetLabel)}</text>` +
    `<text x="68" y="${boxY + 158}" font-size="13" font-family="sans-serif" fill="#666666">Guaranteed Counter-Offer</text>` +
    `<text x="330" y="${boxY + 158}" font-size="30" font-family="sans-serif" font-weight="bold" fill="${escapeXml(payload.tenant.accentColor)}">${escapeXml(payload.competitor.guaranteedCounterOfferLabel)}</text>`
  );
}

function renderQrBlock(payload) {
  const matrix = encodeQrMatrix(payload.verificationUrl, { errorCorrectionLevel: 'M' });
  const qrSvg = renderQrSvg(matrix, { cellSize: 3, margin: 6 });
  return (
    `<g transform="translate(${DOCUMENT_WIDTH - 48 - 150}, 620)">${qrSvg}</g>` +
    `<text x="${DOCUMENT_WIDTH - 48 - 150}" y="790" font-size="11" font-family="sans-serif" fill="#666666">Scan to verify this offer</text>`
  );
}

function renderDisclaimers(payload) {
  const startY = 640;
  const lines = payload.disclaimers
    .map((line, index) => `<text x="48" y="${startY + index * 40}" font-size="12" font-family="sans-serif" fill="#444444" width="500">${escapeXml(line)}</text>`)
    .join('');
  return (
    `<text x="48" y="${startY - 24}" font-size="16" font-family="sans-serif" font-weight="bold" fill="#111318">Terms &amp; Disclaimers</text>` +
    lines +
    `<text x="48" y="${DOCUMENT_HEIGHT - 40}" font-size="11" font-family="sans-serif" fill="#999999">Generated ${escapeXml(payload.generatedAtLabel)} — expires ${escapeXml(payload.expiresAtLabel)}</text>`
  );
}

/** Pure string builder — no DOM access, safe to call in any environment (same shape as qrEncoder.js's renderQrSvg). */
export function renderAppraisalSvg(payload) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${DOCUMENT_WIDTH}" height="${DOCUMENT_HEIGHT}" viewBox="0 0 ${DOCUMENT_WIDTH} ${DOCUMENT_HEIGHT}" role="img" aria-label="Official Counter-Offer Appraisal">` +
    `<rect x="0" y="0" width="${DOCUMENT_WIDTH}" height="${DOCUMENT_HEIGHT}" fill="#ffffff"/>` +
    renderHeader(payload) +
    renderVehicleSummary(payload) +
    renderCompetitorComparison(payload) +
    renderQrBlock(payload) +
    renderDisclaimers(payload) +
    `</svg>`
  );
}

/** Pure composition of payload assembly + SVG rendering + filename derivation. */
export function generateAppraisalDocument({ submission, tenantConfig, verificationBaseUrl = '', now = new Date() } = {}) {
  const payload = buildAppraisalPayload({ submission, tenantConfig, verificationBaseUrl, now });
  const svgMarkup = renderAppraisalSvg(payload);
  const filename = buildAppraisalFilename(payload);
  return { payload, svgMarkup, filename };
}

function defaultDocument() {
  return typeof document !== 'undefined' ? document : null;
}

function defaultCreateObjectUrl(blob) {
  return URL.createObjectURL(blob);
}

function defaultRevokeObjectUrl(url) {
  URL.revokeObjectURL(url);
}

/**
 * DOM-dependent but fully dependency-injected (same precedent as TenantConfigService's
 * createManifestUrl/revokeManifestUrl), so it's unit-tested against a fake document rather than
 * left in the untested View-render tier. No-ops when no document is available (SSR/non-browser).
 */
export function triggerAppraisalDownload(
  svgMarkup,
  filename,
  { document = defaultDocument(), createObjectUrl = defaultCreateObjectUrl, revokeObjectUrl = defaultRevokeObjectUrl } = {},
) {
  if (!document) {
    return false;
  }

  const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
  const url = createObjectUrl(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body?.appendChild?.(link);
  link.click();
  link.remove?.();
  revokeObjectUrl(url);
  return true;
}

/** The single entry point the Lead Inbox / Seller Confirmation views call. */
export function downloadAppraisalSheet({
  submission,
  tenantConfig,
  verificationBaseUrl = '',
  now = new Date(),
  document,
  createObjectUrl,
  revokeObjectUrl,
} = {}) {
  const { payload, svgMarkup, filename } = generateAppraisalDocument({ submission, tenantConfig, verificationBaseUrl, now });
  const triggered = triggerAppraisalDownload(svgMarkup, filename, { document, createObjectUrl, revokeObjectUrl });
  return { payload, svgMarkup, filename, triggered };
}
