import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateVin } from '../vin/generator.js';
import { generateMockOffer } from './mock-offer.js';

// One deterministic sample appraisal per competitor, seeded so mine-pdfs.js produces the same
// fixtures on every run (stable diffs, reproducible OCR ground truth).
const FIXTURE_APPRAISALS = [
  {
    competitor: 'CarMax',
    appraisal: {
      vin: generateVin({ seed: 200101 }),
      year: 2021,
      make: 'Toyota',
      model: 'Camry',
      mileage: 32450,
      offerAmount: 15250,
      storeNumber: '7042',
    },
  },
  {
    competitor: 'Carvana',
    appraisal: {
      vin: generateVin({ seed: 200102 }),
      year: 2020,
      make: 'Ford',
      model: 'F-150',
      mileage: 48120,
      offerAmount: 27800,
    },
  },
  {
    competitor: 'Hendrick',
    appraisal: {
      vin: generateVin({ seed: 200103 }),
      year: 2022,
      make: 'Honda',
      model: 'CR-V',
      mileage: 21300,
      offerAmount: 22150,
      storeName: 'Hendrick Chevrolet Cary',
    },
  },
  {
    competitor: 'KBB',
    appraisal: {
      vin: generateVin({ seed: 200104 }),
      year: 2023,
      make: 'Tesla',
      model: 'Model 3',
      mileage: 12800,
      offerAmount: 31900,
    },
  },
];

function slugFor(competitor) {
  return competitor.toLowerCase();
}

/**
 * Writes one `.txt` (raw OCR/parser fixture) and one `.json` (ground-truth metadata) file per
 * competitor into `targetDir`, plus a `manifest.json` indexing them. Returns the manifest object.
 */
export function generateFixtures(targetDir) {
  mkdirSync(targetDir, { recursive: true });

  const documents = FIXTURE_APPRAISALS.map(({ competitor, appraisal }) => {
    const offer = generateMockOffer(competitor, appraisal);
    const slug = slugFor(competitor);
    const textFile = `${slug}-offer.txt`;
    const metadataFile = `${slug}-offer.json`;

    writeFileSync(join(targetDir, textFile), `${offer.text}\n`, 'utf8');
    writeFileSync(join(targetDir, metadataFile), `${JSON.stringify(offer.payload, null, 2)}\n`, 'utf8');

    return {
      competitor,
      textFile,
      metadataFile,
      groundTruth: offer.payload,
    };
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    documents,
  };

  writeFileSync(join(targetDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return manifest;
}
