import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fixtures', 'offers');

function readManifest() {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, 'manifest.json'), 'utf8'));
}

test('manifest.json lists one document entry per supported competitor', () => {
  const manifest = readManifest();
  assert.ok(Array.isArray(manifest.documents));
  assert.deepEqual(
    manifest.documents.map((doc) => doc.competitor).sort(),
    ['CarMax', 'Carvana', 'Hendrick', 'KBB'],
  );
});

test('every manifest entry points at a text file and a metadata file that exist and parse cleanly', () => {
  const manifest = readManifest();

  for (const doc of manifest.documents) {
    const text = readFileSync(join(FIXTURES_DIR, doc.textFile), 'utf8');
    assert.ok(text.trim().length > 0, `${doc.textFile} should not be empty`);
    assert.match(text, new RegExp(doc.groundTruth.vin), `${doc.textFile} should contain its ground-truth VIN`);

    const metadataRaw = readFileSync(join(FIXTURES_DIR, doc.metadataFile), 'utf8');
    const metadata = JSON.parse(metadataRaw);
    assert.equal(metadata.vin, doc.groundTruth.vin);
    assert.equal(metadata.offerAmount, doc.groundTruth.offerAmount);
    assert.equal(typeof metadata.mileage, 'number');
  }
});
