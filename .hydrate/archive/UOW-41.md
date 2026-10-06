# UOW-41: Unify Static and API Server Runtime

## Goal & Context
Currently, local execution requires two separate commands and ports: `npx serve` on 8080 for static PWA files and `node src/server/index.js` for Hono API endpoints. 

This UOW consolidates static asset serving and API routing into the single Hono server entry point (`src/server/index.js`), eliminating port divergence, CORS requirements, and multi-process overhead, establishing `npm start` as the single canonical boot command.

## Architectural Constraints
- **Zero New Dependencies:** Use existing `@hono/node-server/serve-static` or native Hono static middleware.
- **Port Contract:** Default to `process.env.PORT || 8080`.
- **Precedence:** Explicit API routes (`/api/*`) take precedence before static file fallbacks.
- **PWA Asset Integrity:** Serve root static files (`index.html`, `manifest.json`, `sw.js`), `/src/` modules, `/public/` assets, and vendor directories identically to `npx serve .`.

## Surgical Scope
1. **Server Configuration (`src/server/index.js`):**
   - Mount static file serving middleware for the repository root / web root.
   - Ensure MIME types for JavaScript ES modules (`.js` as `application/javascript`) and web manifests are handled cleanly.
   - Bind server listener to `process.env.PORT || 8080`.
2. **Package Scripts (`package.json`):**
   - Update `"start"` script to run `node src/server/index.js`.
   - Remove redundant `"start:server"` or alias it cleanly.
   - Ensure `"prestart"` hooks continue generating runtime configs and vendor assets before boot.
3. **Verification:**
   - Verify `GET http://localhost:8080/` serves the PWA application shell.
   - Verify `POST http://localhost:8080/api/offers/parse` handles document extraction without CORS or 404 errors.
   - Ensure all 620 existing tests pass via `npm test`.

## Acceptance Criteria
- [x] Running `npm start` boots a single process on port 8080 that serves both the PWA UI and the Hono API routes.
- [x] `POST /api/offers/parse` responds correctly from the same host/port as the frontend without manual proxy configuration.
- [x] Drag-and-drop document upload and auto-population work seamlessly on `http://localhost:8080`.
- [x] `npm test` passes cleanly with 100% success (620+ tests).
