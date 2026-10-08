# Offer Fixtures

This directory holds the raw competitor offer documents (text, and real photos/screenshots)
used by:

- **The parser test suite** (`tests/offerParser.test.js`, `tests/server.test.js`) — unit/route
  tests against individual fixtures.
- **The fixture harness** (`tests/integration/fixtureHarness.test.js`) — a data-driven,
  full-pipeline golden test that runs every fixture here through parse → spread math → the
  appraisal SVG generator, checked against ground truth in `tests/fixtures/manifest.json`.
- **Dev/demo presets** — the Test Bed drawer and the Sell form's dropzone use these same
  documents for offline, no-network local development and live demos.

If you're adding a new competitor offer fixture (a new screenshot, a new written-offer text
file), this doc is the whole process end to end.

## 1. Overview

### Why this directory exists

Every fixture here is a **real-shaped example of a competitor's offer document** — something a
seller might upload when selling their car. The app extracts structured data from it
(`src/server/offerParser.js`) and uses that to pre-fill the Sell form and drive the spread/
counter-offer math. These fixtures are what prove that extraction actually works, without
depending on a live OCR/vision vendor or a real seller's phone.

### `FIRM_OFFER` vs. `ESTIMATE`

Every fixture represents one of two distinct real-world document types, and the app tracks
which one via `Submission.offerSourceType` (`src/models/Submission.js`):

| | `FIRM_OFFER` | `ESTIMATE` |
|---|---|---|
| What it is | An official, VIN-locked written offer (a CarMax/Carvana/KBB offer letter, a dealer trade slip) | A VIN-less online "Estimate" screen, screenshotted by the seller (e.g. Carvana's instant quote) |
| Has a VIN? | Yes — printed on the document itself | No — these screens deliberately omit the VIN to avoid lead spam before the seller commits |
| How the app completes a `Submission` | The VIN comes straight from the parsed document | A **seed VIN** has to be supplied separately (by the seller scanning/typing their own VIN, or — for fixtures — a VIN you provide in the manifest) before spread math can run, since `Submission` always requires one |
| Appraisal sheet wording | "Guaranteed Competitor Beat Offer" | "Conditional Counter-Offer (Pending Vehicle Inspection & VIN Verification)" |
| Lead Inbox badge | Green `[FIRM COUNTER]` | Amber `[ESTIMATE COUNTER]` |

A fixture's type isn't a free-text label — it's derived from what the parser actually extracts:
if `extracted.isEstimate === true` and there's no `extracted.vin`, the offer is an `ESTIMATE`;
otherwise it's a `FIRM_OFFER`. Keep this consistent when you register a new fixture (see §3).

## 2. Fixture Directory Architecture

| What | Where |
|---|---|
| Raw fixture files (what you add) | `public/fixtures/offers/` (this directory) |
| Ground truth for the full-pipeline harness | `tests/fixtures/manifest.json` |
| Extraction routing / regex heuristics / image-hash lookup | `src/server/offerParser.js` |
| The full-pipeline test that exercises every fixture | `tests/integration/fixtureHarness.test.js` |
| Re-baseline CLI for the manifest's extraction snapshot | `scripts/update-fixture-manifest.js` (`npm run fixtures:update`) |

**A note on the two `manifest.json` files — they are not the same thing:**

- `public/fixtures/offers/manifest.json` (this directory) is a **pre-existing, separate**
  fixture-miner index (`textFile`/`metadataFile`/`groundTruth` shape) read only by
  `tests/offerGalleryFixtures.test.js`. It predates this guide and isn't part of the workflow
  below.
- `tests/fixtures/manifest.json` is the one this guide is about — the ground-truth manifest for
  `fixtureHarness.test.js`.

Don't confuse the two, and don't add a new fixture to only one of them.

## 3. Step-by-Step: Adding a New Fixture

### 3.1 File placement and naming

Drop the raw file directly in `public/fixtures/offers/`. Name it in **kebab-case**, describing
competitor + document type + vehicle, e.g.:

```
carvana-estimate-2020-jeep.jpeg
carmax-offer-2022-f150.pdf
kbb-offer-2023-model3.txt
```

### 3.2 If it's an image (JPEG/PNG/HEIC)

Images are matched by **exact content hash**, not OCR — there's no vision/OCR library wired in
(same zero-dependency precedent as the rest of this app's client/server modules), so a
real/unrecognized photo degrades gracefully to an empty extraction rather than guessing.
Registering an image fixture means adding its hash to a lookup table:

1. **Compute the SHA-256 hash of the file:**

   ```sh
   shasum -a 256 public/fixtures/offers/carvana-estimate-2020-jeep.jpeg
   ```

2. **Add an entry to `IMAGE_FIXTURES` in `src/server/offerParser.js`**, keyed by that hash:

   ```js
   const IMAGE_FIXTURES = {
     // ...existing entries...
     '<paste the sha256 hash here>': {
       competitorName: 'Carvana',
       competitorOffer: 13100,
       year: 2020,
       make: 'Jeep',
       model: 'Wrangler Unlimited',
       isEstimate: true, // omit this (and add a `vin` field instead) for a FIRM_OFFER-type image
     },
   };
   ```

   Only include the fields the document actually shows. `isEstimate: true` is what marks this as
   a VIN-less `ESTIMATE` fixture downstream — for a photographed *firm* offer letter with a
   legible VIN, add `vin: '...'` instead and omit `isEstimate`.

3. Confirm the mime type you'll send matches one `offerParser.js` routes through the image path:
   `image/jpeg`, `image/png`, or `image/heic` (`IMAGE_MIME_TYPES`). Anything else falls through to
   the text/regex path described below, even for an image file.

### 3.3 If it's text or a PDF

Non-image mime types are decoded as UTF-8 text and scanned with regex heuristics
(`extractFromText()` in `src/server/offerParser.js`) — no registration step needed, it's just
pattern matching against whatever text comes out of the decode:

- **Competitor name:** `COMPETITOR_KEYWORDS` matches `carmax`/`carvana`/`kbb`/`kelley blue
  book`/`driveway` (case-insensitive), else falls back to the document's first short, legible
  line as a low-confidence guess.
- **VIN:** `findValidVin()` (from `src/utils/vinScanner.js`) scans for any 17-character,
  ISO 3779 checksum-valid VIN-alphabet run anywhere in the text.
- **Offer amount:** `OFFER_AMOUNT_PATTERN` looks for a dollar amount near the words "offer",
  "trade value", or "cash offer"; falls back to the first bare `$amount` in the document.
  **Mileage:** `MILEAGE_PATTERN` looks for `Mileage: <number>`.
- **Year/Make/Model:** `VEHICLE_LINE_PATTERN` looks for a bare `"<year> <make> <model>"` run
  (e.g. `"2020 Ford F-150"`) somewhere in the text — a VIN's own position-10 year code is
  deliberately *not* used for this, since it repeats on a 30-year cycle and can't be trusted.

**Important PDF caveat:** a real, binary PDF does not decode to meaningful UTF-8 text (there's no
PDF-parsing library here), so dropping an actual exported PDF in as a fixture will likely extract
nothing. For a fixture to work through this path today, write it as a **plain-text `.txt` file**
that reproduces the offer document's visible text layout (see the existing `*-offer.txt`
fixtures for the pattern) — name it `.txt`, not `.pdf`, even if it's standing in for a PDF-shaped
real-world document.

### 3.4 Updating `tests/fixtures/manifest.json`

Add one entry to the `entries` array. Each entry has two distinct ground-truth tiers — don't
conflate them:

- **`expectedExtraction`** — a snapshot of exactly what `offerParser.js` **actually extracts**
  from this specific file today. Only include the keys the parser really finds for this
  document (some fixtures don't have a vehicle-line, so they never extract `year`/`make`/
  `model` — that's expected, not a bug). The easiest way to get this right: run the fixture
  through the parser once and copy its output, or just add your entry with a placeholder and run
  `npm run fixtures:update` (§4) to fill it in for you.
- **`vehicle`** — the **full, real-world ground truth** for the vehicle (year/make/model/VIN/
  mileage), used to complete the `Submission` payload in Stage 2 of the harness whenever
  extraction itself came back partial (`mapExtractedOfferToFormValues(extracted).field ??
  entry.vehicle.field`). For an `ESTIMATE` fixture, `vehicle.vin` **must** be a seed VIN you
  supply — a real, **ISO 3779 checksum-valid**, 17-character VIN, since `Submission` always
  requires one and the estimate document itself has none. Validate it before committing:

  ```sh
  node -e "import('./src/utils/vinScanner.js').then(({ validateVin }) => console.log(validateVin('YOUR17CHARVINHERE')))"
  ```

  This must print `true`. A checksum-invalid VIN will still "work" (`Submission` doesn't enforce
  the checksum), but it defeats the point of a *ground-truth* fixture — don't commit one.

#### Template: `FIRM_OFFER` fixture (VIN present in the document)

```json
{
  "filename": "carmax-offer-2022-f150.pdf",
  "mimeType": "text/plain",
  "competitor": "CarMax",
  "offerSourceType": "FIRM_OFFER",
  "expectedAmount": 21500,
  "expectedExtraction": {
    "vin": "1FTFW1E84NFA00000",
    "competitorName": "CarMax",
    "competitorOffer": 21500,
    "mileage": 28000
  },
  "vehicle": {
    "year": 2022,
    "make": "Ford",
    "model": "F-150",
    "vin": "1FTFW1E84NFA00000",
    "mileage": 28000
  }
}
```

#### Template: `ESTIMATE` fixture (VIN-less screenshot, seed VIN required)

```json
{
  "filename": "carvana-estimate-2020-jeep.jpeg",
  "mimeType": "image/jpeg",
  "competitor": "Carvana",
  "offerSourceType": "ESTIMATE",
  "expectedAmount": 13100,
  "expectedExtraction": {
    "competitorName": "Carvana",
    "competitorOffer": 13100,
    "year": 2020,
    "make": "Jeep",
    "model": "Wrangler Unlimited",
    "isEstimate": true
  },
  "vehicle": {
    "year": 2020,
    "make": "Jeep",
    "model": "Wrangler Unlimited",
    "vin": "1C4HJXDG7LW123456",
    "mileage": 35000
  }
}
```

`mimeType` must be whatever you'll actually send through `/api/offers/parse` for this file
(`text/plain` for a `.txt`, `image/jpeg`/`image/png`/`image/heic` for an image) — it's what
`fixtureHarness.test.js` passes on your behalf, and it's what determines whether `offerParser.js`
routes the bytes through the image-hash path or the text/regex path.

## 4. Maintenance & Verification Commands

| Command | What it does |
|---|---|
| `npm test` | Runs the whole suite, including `fixtureHarness.test.js` against every registered fixture and the parser/route unit tests. |
| `npm run fixtures:update` | Re-baselines **only** `expectedExtraction` in `tests/fixtures/manifest.json`, by re-running the real parser against every fixture's actual bytes. Run this after an *intentional* `offerParser.js` change (a new competitor keyword, a smarter regex, a new image fixture) so the manifest reflects the new behavior instead of hand-editing JSON. It never touches `filename`/`mimeType`/`competitor`/`offerSourceType`/`expectedAmount`/`vehicle` — those are business ground truth the parser can't determine on its own. |

### The coverage guardrail

`fixtureHarness.test.js` includes a test that lists every file in this directory except `.json`
(metadata companions / the legacy fixture-miner index) and `.md` (this README) and asserts each
one has a matching entry in `tests/fixtures/manifest.json`. **This is intentional, not a bug:**
if you add a fixture file here and forget to register it in the manifest, `npm test` fails
immediately with a clear mismatch, instead of the new fixture silently never being exercised by
anything. If you see that failure, you almost certainly just skipped §3.4 above.

Spread math (the counter-offer and margin calculation) and the appraisal SVG's banner text are
**never snapshotted** anywhere — `fixtureHarness.test.js` recomputes both independently against
whatever `SpreadConfigService` is currently configured, every run. There's nothing to re-baseline
for those; if the configured pricing tiers change, the test's own expectations change with them
automatically.
