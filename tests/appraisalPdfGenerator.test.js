import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPIRATION_WINDOW_DAYS,
  MILE_ALLOWANCE_MILES,
  DOCUMENT_WIDTH,
  DOCUMENT_HEIGHT,
  buildVerificationUrl,
  buildAppraisalPayload,
  buildAppraisalFilename,
  renderAppraisalSvg,
  generateAppraisalDocument,
  triggerAppraisalDownload,
  downloadAppraisalSheet,
} from '../src/utils/appraisalPdfGenerator.js';
import { createTenantConfig } from '../src/config/tenantConfig.js';

function baseSubmission(overrides = {}) {
  return {
    id: 't1-sub-7',
    vin: '1HGCM82633A004352',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    trim: 'SE',
    mileage: 30000,
    zipCode: '28451',
    competitor: 'CarMax',
    competitorOfferAmount: 15000,
    initialCompetitorOffer: 15000,
    finalCounterOffer: 15750,
    ...overrides,
  };
}

test('buildVerificationUrl encodes the submission id into a query string', () => {
  const url = buildVerificationUrl('https://app.example.com/', baseSubmission({ id: 't1-sub-7 x' }));
  assert.equal(url, 'https://app.example.com/?tab=sell&sid=t1-sub-7%20x');
});

test('buildVerificationUrl tolerates an empty base url', () => {
  const url = buildVerificationUrl(undefined, baseSubmission({ id: 'abc' }));
  assert.equal(url, '?tab=sell&sid=abc');
});

test('buildAppraisalPayload throws without a submission', () => {
  assert.throws(() => buildAppraisalPayload({ tenantConfig: createTenantConfig() }), /requires a submission/);
});

test('buildAppraisalPayload throws without a tenantConfig', () => {
  assert.throws(() => buildAppraisalPayload({ submission: baseSubmission() }), /requires a tenantConfig/);
});

test('buildAppraisalPayload throws when the submission has no finalCounterOffer', () => {
  assert.throws(
    () =>
      buildAppraisalPayload({
        submission: baseSubmission({ finalCounterOffer: undefined }),
        tenantConfig: createTenantConfig(),
      }),
    /requires a submission with a finalCounterOffer/,
  );
});

test('buildAppraisalPayload falls back to competitorOfferAmount when initialCompetitorOffer is absent', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission({ initialCompetitorOffer: undefined, competitorOfferAmount: 14000 }),
    tenantConfig: createTenantConfig(),
  });
  assert.equal(payload.competitor.originalOfferAmount, 14000);
});

test('buildAppraisalPayload computes a positive signed spread offset label', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission({ initialCompetitorOffer: 15000, finalCounterOffer: 15750 }),
    tenantConfig: createTenantConfig(),
  });
  assert.equal(payload.competitor.spreadOffsetAmount, 750);
  assert.equal(payload.competitor.spreadOffsetLabel, '+$750');
  assert.equal(payload.competitor.guaranteedCounterOfferLabel, '$15,750');
  assert.equal(payload.competitor.originalOfferLabel, '$15,000');
});

test('buildAppraisalPayload computes a negative signed spread offset label', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission({ initialCompetitorOffer: 15000, finalCounterOffer: 14500 }),
    tenantConfig: createTenantConfig(),
  });
  assert.equal(payload.competitor.spreadOffsetAmount, -500);
  assert.equal(payload.competitor.spreadOffsetLabel, '-$500');
});

test('buildAppraisalPayload labels an Other competitor with the dealer name', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission({ competitor: 'Other', competitorDealerName: 'Hendrick Motors' }),
    tenantConfig: createTenantConfig(),
  });
  assert.equal(payload.competitor.name, 'Hendrick Motors');
});

test('buildAppraisalPayload computes expiration relative to the injected now', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const payload = buildAppraisalPayload({ submission: baseSubmission(), tenantConfig: createTenantConfig(), now });
  assert.equal(payload.expiresAtLabel, new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date('2026-01-08T00:00:00.000Z')));
});

test('buildAppraisalPayload includes mile-allowance and expiration disclaimers', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission(),
    tenantConfig: createTenantConfig({ name: 'Acme Motors' }),
  });
  assert.equal(payload.mileAllowanceMiles, MILE_ALLOWANCE_MILES);
  assert.equal(payload.disclaimers.length, 5);
  assert.match(payload.disclaimers[0], new RegExp(`${EXPIRATION_WINDOW_DAYS} days`));
  assert.match(payload.disclaimers[1], new RegExp(`${MILE_ALLOWANCE_MILES} miles`));
  assert.match(payload.disclaimers[2], /Acme Motors inspection/);
});

test('buildAppraisalPayload includes hardened title/theft verification disclaimers (UOW-49)', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission(),
    tenantConfig: createTenantConfig({ name: 'Acme Motors' }),
  });
  assert.match(payload.disclaimers[3], /strictly conditional upon a satisfactory physical title inspection/);
  assert.match(payload.disclaimers[4], /NMVTIS/);
  assert.match(payload.disclaimers[4], /CARFAX\/AutoCheck/);
  assert.match(payload.disclaimers[4], /salvage, flood, lemon/);
  assert.match(payload.disclaimers[4], /lien release/);
  assert.match(payload.disclaimers[4], /NICB theft records/);
});

test('buildAppraisalPayload labels a FIRM_OFFER (and the default, unset) counter as guaranteed', () => {
  const defaulted = buildAppraisalPayload({ submission: baseSubmission(), tenantConfig: createTenantConfig() });
  assert.equal(defaulted.title, 'Guaranteed Competitor Beat Offer');

  const explicit = buildAppraisalPayload({
    submission: baseSubmission({ offerSourceType: 'FIRM_OFFER' }),
    tenantConfig: createTenantConfig(),
  });
  assert.equal(explicit.title, 'Guaranteed Competitor Beat Offer');
});

test('buildAppraisalPayload labels an ESTIMATE-sourced counter as conditional on inspection/VIN verification', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission({ offerSourceType: 'ESTIMATE' }),
    tenantConfig: createTenantConfig(),
  });
  assert.equal(payload.title, 'Conditional Counter-Offer (Pending Vehicle Inspection & VIN Verification)');
});

test('buildAppraisalPayload falls back to primary theme color when accent is unset', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission(),
    tenantConfig: createTenantConfig({ themeColors: { primary: '#ABCDEF' } }),
  });
  assert.equal(payload.tenant.accentColor, '#ABCDEF');
});

test('buildAppraisalFilename slugs the tenant name and vin', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission({ vin: '1HGCM82633A004352' }),
    tenantConfig: createTenantConfig({ name: 'Summit Auto Group!' }),
  });
  assert.equal(buildAppraisalFilename(payload), 'summit-auto-group-appraisal-1hgcm82633a004352.svg');
});

test('buildAppraisalFilename falls back to "pending-vin" when the submission has no vin yet', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission({ vin: null, offerSourceType: 'ESTIMATE' }),
    tenantConfig: createTenantConfig({ name: 'Summit Auto Group!' }),
  });
  assert.equal(buildAppraisalFilename(payload), 'summit-auto-group-appraisal-pending-vin.svg');
});

test('renderAppraisalSvg shows "Pending Verification" in place of a missing vin', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission({ vin: null, offerSourceType: 'ESTIMATE' }),
    tenantConfig: createTenantConfig(),
  });
  assert.match(renderAppraisalSvg(payload), /Pending Verification/);
});

test('renderAppraisalSvg produces a root svg sized to the printable document', () => {
  const payload = buildAppraisalPayload({ submission: baseSubmission(), tenantConfig: createTenantConfig() });
  const svg = renderAppraisalSvg(payload);
  assert.match(svg, new RegExp(`width="${DOCUMENT_WIDTH}" height="${DOCUMENT_HEIGHT}"`));
  assert.match(svg, /^<svg /);
});

test('renderAppraisalSvg includes tenant, vehicle, competitor, and QR content', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission(),
    tenantConfig: createTenantConfig({ name: 'Acme Motors' }),
  });
  const svg = renderAppraisalSvg(payload);
  assert.match(svg, /Acme Motors/);
  assert.match(svg, /1HGCM82633A004352/);
  assert.match(svg, /CarMax/);
  assert.match(svg, /\$15,750/);
  assert.match(svg, /Scan to verify this offer/);
  // renderQrSvg's nested output carries this marker
  assert.match(svg, /role="img"/);
});

test('renderAppraisalSvg embeds the conditional-counter label for an ESTIMATE-sourced submission', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission({ offerSourceType: 'ESTIMATE' }),
    tenantConfig: createTenantConfig({ name: 'Acme Motors' }),
  });
  const svg = renderAppraisalSvg(payload);
  assert.match(svg, /Conditional Counter-Offer \(Pending Vehicle Inspection &amp; VIN Verification\)/);
});

test('renderAppraisalSvg escapes XML-significant characters in free text', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission({ competitor: 'Other', competitorDealerName: 'Bob\'s <Cars> & "Trucks"' }),
    tenantConfig: createTenantConfig({ name: 'Acme <Motors> & Co' }),
  });
  const svg = renderAppraisalSvg(payload);
  assert.doesNotMatch(svg, /<Motors>/);
  assert.match(svg, /Acme &lt;Motors&gt; &amp; Co/);
  assert.match(svg, /Bob&apos;s &lt;Cars&gt; &amp; &quot;Trucks&quot;/);
});

test('renderAppraisalSvg embeds the hardened title/NMVTIS/theft disclaimers, word-wrapped without truncation', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission(),
    tenantConfig: createTenantConfig({ name: 'Acme Motors' }),
  });
  const svg = renderAppraisalSvg(payload);

  assert.match(svg, /physical title inspection/);
  assert.match(svg, /NMVTIS/);
  assert.match(svg, /CARFAX\/AutoCheck/);
  assert.match(svg, /NICB theft records/);

  // Every disclaimer <text> line must be short enough to render fully within the document's
  // printable width — none should be cut off at the document's right edge.
  const textContents = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(([, content]) => content);
  const disclaimerLines = textContents.filter((text) => text.length > 0 && !text.startsWith('Generated '));
  for (const line of disclaimerLines) {
    assert.ok(line.length <= 140, `expected line "${line}" to be wrapped under 140 chars`);
  }
});

test('renderAppraisalSvg embeds a logo <image> when logoUrl is set', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission(),
    tenantConfig: createTenantConfig({ name: 'Acme', logoUrl: 'data:image/png;base64,AAAA' }),
  });
  const svg = renderAppraisalSvg(payload);
  assert.match(svg, /<image href="data:image\/png;base64,AAAA"/);
});

test('renderAppraisalSvg falls back to an initials circle when logoUrl is absent', () => {
  const payload = buildAppraisalPayload({
    submission: baseSubmission(),
    tenantConfig: createTenantConfig({ name: 'Acme Motors', logoUrl: '' }),
  });
  const svg = renderAppraisalSvg(payload);
  assert.doesNotMatch(svg, /<image /);
  assert.match(svg, /<circle /);
  assert.match(svg, />AC</);
});

test('generateAppraisalDocument composes payload, svgMarkup, and filename', () => {
  const result = generateAppraisalDocument({ submission: baseSubmission(), tenantConfig: createTenantConfig({ name: 'Acme' }) });
  assert.ok(result.payload);
  assert.match(result.svgMarkup, /^<svg /);
  assert.equal(result.filename, `acme-appraisal-${baseSubmission().vin.toLowerCase()}.svg`);
});

function createFakeAnchor() {
  return {
    attrs: {},
    clicked: 0,
    removed: false,
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    click() {
      this.clicked += 1;
    },
    remove() {
      this.removed = true;
    },
  };
}

function createFakeDocument() {
  const body = { appended: [], appendChild(el) { this.appended.push(el); } };
  const created = [];
  return {
    body,
    created,
    createElement(tag) {
      assert.equal(tag, 'a');
      const el = createFakeAnchor();
      created.push(el);
      return el;
    },
  };
}

test('triggerAppraisalDownload no-ops when no document is available', () => {
  assert.equal(triggerAppraisalDownload('<svg/>', 'x.svg', { document: null }), false);
});

test('triggerAppraisalDownload builds a Blob, sets anchor attributes, clicks, and revokes the url', () => {
  const document = createFakeDocument();
  const createdUrls = [];
  const revoked = [];
  const result = triggerAppraisalDownload('<svg><rect/></svg>', 'acme-appraisal.svg', {
    document,
    createObjectUrl: (blob) => {
      createdUrls.push(blob);
      return 'blob:fake-1';
    },
    revokeObjectUrl: (url) => revoked.push(url),
  });

  assert.equal(result, true);
  assert.equal(createdUrls.length, 1);
  assert.equal(createdUrls[0].type, 'image/svg+xml');
  const [link] = document.created;
  assert.equal(link.attrs.href, 'blob:fake-1');
  assert.equal(link.attrs.download, 'acme-appraisal.svg');
  assert.equal(link.clicked, 1);
  assert.equal(link.removed, true);
  assert.deepEqual(revoked, ['blob:fake-1']);
  assert.deepEqual(document.body.appended, [link]);
});

test('downloadAppraisalSheet composes generation and download-trigger, returning triggered: true', () => {
  const document = createFakeDocument();
  const result = downloadAppraisalSheet({
    submission: baseSubmission(),
    tenantConfig: createTenantConfig({ name: 'Acme' }),
    document,
    createObjectUrl: () => 'blob:fake-2',
    revokeObjectUrl: () => {},
  });

  assert.equal(result.triggered, true);
  assert.equal(result.filename, `acme-appraisal-${baseSubmission().vin.toLowerCase()}.svg`);
  assert.match(result.svgMarkup, /^<svg /);
  assert.equal(document.created[0].attrs.download, result.filename);
});
