Build a real-world competitor offer mining script and web document test gallery across @nemzilla/test-core and carboyz:

1. Extend @nemzilla/test-core (in ../test-core):
   - Create bin/mine-pdfs.js as an executable CLI tool.
   - Implement generateFixtures(targetDir) that outputs realistic offer sheets representing CarMax, Carvana, Hendrick Automotive Group, and KBB Instant Cash Offer.
   - Include authentic structural text, headers, VINs, mileage, expiration dates, and offer amounts.
   - For each sample, save a raw document text file (.txt), metadata JSON file (.json), and generate a manifest.json file containing document paths and ground truth specs.
   - Default the output directory to ../carboyz/public/fixtures/offers (or ./public/fixtures/offers relative to carboyz root).

2. Build Web Document Gallery in carboyz:
   - Create offer-gallery.html in the carboyz root directory.
   - Dynamically load /public/fixtures/offers/manifest.json and render visual offer cards for each vendor.
   - Format each card with styled, high-contrast monospace document previews (suitable for testing mobile camera photos/OCR uploads) and direct text/PDF download buttons.

3. Execution & Verification:
   - Run `node ../test-core/bin/mine-pdfs.js` to populate the fixture files.
   - Write or update unit tests in carboyz (e.g. tests/offerGalleryFixtures.test.js) to verify all fixture files in public/fixtures/offers exist and parse cleanly.
   - Run `npm test` and ensure all tests pass.
   - Commit the changes in carboyz with message: feat(dev): add real-world offer miner script and web test gallery
