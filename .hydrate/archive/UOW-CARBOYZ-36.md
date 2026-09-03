Update vin-testbed.html in carboyz to optimize Code 39 barcode rendering for mobile camera scanners:

1. Barcode Styling & Layout Adjustments:
   - Modify the JsBarcode configuration to increase element width (`width: 2.5`), height (`height: 80`), and add a generous quiet zone (`margin: 12`).
   - Style `.barcode-container` with `#ffffff` background, `padding: 1.25rem`, rounded corners, and explicit max-width containment (`max-width: 100%`, `overflow: hidden`).
   - Ensure the SVG element (`.barcode-container svg`) scales fluidly across desktop and mobile screens (`max-width: 100%`, `height: auto`, `display: block`, `margin: 0 auto`).

2. Card & Grid Enhancements:
   - Update grid cards to ensure crisp contrast against dark dark background (#0f172a / #1e293b).
   - Display the VIN string below the barcode in a bold monospace font with clear letter-spacing.

3. Verification:
   - Run `npm start` and verify `http://localhost:8080/vin-testbed.html` renders well-spaced, non-overflowing barcodes across all 4 sample vehicle cards.
   - Run `npm test` to ensure no regressions across carboyz tests.
   - Commit changes with message: style(testbed): optimize Code 39 barcode rendering for mobile camera scanning
