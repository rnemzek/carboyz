import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseOfferDocument } from '../src/server/offerParser.js';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturesDir = join(rootDir, 'public', 'fixtures', 'offers');
const manifestPath = join(rootDir, 'tests', 'fixtures', 'manifest.json');

/**
 * Re-baselines tests/fixtures/manifest.json's `expectedExtraction` block for every entry by
 * re-running the real parseOfferDocument() against each fixture's actual bytes — the snapshot
 * half of tests/integration/fixtureHarness.test.js's golden assertions. Run this after an
 * intentional offerParser.js change (a new competitor keyword, a smarter vehicle-line regex,
 * etc.) so the manifest reflects the new, intended extraction behavior instead of hand-editing
 * JSON. Every other field (competitor/offerSourceType/expectedAmount/vehicle) is business ground
 * truth the parser can't determine on its own and is left untouched — Stage 2/3 of the harness
 * (spread math, SVG artifact) are never snapshotted here either, since they're asserted dynamically
 * against whatever SpreadConfigService is currently configured, not frozen expected values.
 */
function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  for (const entry of manifest.entries) {
    const bytes = readFileSync(join(fixturesDir, entry.filename));
    const { extracted } = parseOfferDocument({
      documentBase64: bytes.toString('base64'),
      mimeType: entry.mimeType,
    });
    entry.expectedExtraction = extracted;
    console.log(`fixtures:update: re-baselined ${entry.filename}`);
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`fixtures:update: wrote ${manifest.entries.length} entries to ${manifestPath}`);
}

main();
