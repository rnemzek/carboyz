Fix browser CORS / node:fs import crash when loading carboyz in the browser:

1. Update @nemzilla/test-core (in ../test-core):
   - Separate Node-only CLI utilities (fs/path dependent file generators) from browser-safe domain logic (VIN generators, NHTSA decoders, mock offer formatters).
   - Update ../test-core/src/index.js (or package exports) so the main entry point exposed to browsers does NOT statically import `node:fs` or `node:path`.
   - Ensure CLI scripts (`bin/mine-pdfs.js`) import Node modules directly or via a dedicated subpath (e.g. `../test-core/src/node/miner.js`), while browser-safe modules remain 100% clean of Node built-ins.

2. Re-vendor & Wire in carboyz:
   - Run `node scripts/vendor-test-core.js` to refresh `vendor/@nemzilla/test-core/`.
   - Verify `index.html` importmap resolves `@nemzilla/test-core` to the clean browser-safe bundle entry point.

3. Verification:
   - Run `npm test` in both `../test-core` and `carboyz` to confirm all 597+ unit tests pass.
   - Run `npm start`, fetch `http://localhost:8080`, `http://localhost:8080/vin-testbed.html`, and `http://localhost:8080/offer-gallery.html` using a headless browser/curl pass to verify HTTP 200 responses with zero `node:fs` runtime errors.
