import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const spatialCorePkgDir = join(rootDir, 'node_modules', '@nemzilla', 'spatial-core');
const vendorDir = join(rootDir, 'vendor');

// Runtime JS only — .map/.d.ts/docs/tests/benchmarks are never fetched by the browser but would
// otherwise bloat this committed vendor snapshot considerably (whole-package copies pull in a lot
// that's irrelevant here). Doesn't attempt to trace which specific files within a package are
// actually reachable from its entry point — that needs a bundler (explicitly out of scope) or
// fragile manual tracing; keeping every runtime .js file is the safe tradeoff.
const SKIP_NAME_PATTERNS = [/\.map$/, /\.d\.ts$/, /\.d\.cts$/, /\.md$/i, /^(LICENSE|NOTICE|CHANGELOG|CONTRIBUTING|RELEASE)/i];
const SKIP_DIR_NAMES = new Set(['test', 'tests', 'benchmark', 'benchmarks', '.github']);

function vendorFilter(source) {
  const name = basename(source);
  if (SKIP_DIR_NAMES.has(name)) return false;
  return !SKIP_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Copies @nemzilla/spatial-core's built dist/ plus its runtime deps (zod, h3-js) into vendor/, which
 * IS committed to git (unlike node_modules/ or the gitignored runtime-config.js) — this repo has no
 * bundler by design (see index.html's <script type="importmap">), and @nemzilla/spatial-core is a
 * `file:../spatial-core` dependency pointing at a sibling directory that only exists on a developer's
 * machine. In a fresh deploy (Railway clones only this repo) that sibling never exists, so
 * `npm install` can't resolve it and node_modules/@nemzilla/spatial-core (plus its nested zod/h3-js)
 * end up missing — the production 404 this script exists to fix.
 *
 * Runs as part of `prestart`, refreshing vendor/ from node_modules whenever the sibling repo actually
 * resolved locally. On a deploy where it didn't (or wasn't reinstalled), this is a no-op and the
 * already-committed vendor/ snapshot from the last local run is what ships — same graceful-degradation
 * shape as scripts/generate-runtime-config.js's handling of a missing .env.local.
 */
function main() {
  if (!existsSync(spatialCorePkgDir)) {
    console.log('vendor-spatial-core: node_modules/@nemzilla/spatial-core not found, skipping (using committed vendor/).');
    return;
  }

  rmSync(vendorDir, { recursive: true, force: true });
  cpSync(join(spatialCorePkgDir, 'dist'), join(vendorDir, 'spatial-core', 'dist'), { recursive: true, filter: vendorFilter });
  cpSync(join(spatialCorePkgDir, 'node_modules', 'zod'), join(vendorDir, 'zod'), { recursive: true, filter: vendorFilter });
  cpSync(join(spatialCorePkgDir, 'node_modules', 'h3-js'), join(vendorDir, 'h3-js'), { recursive: true, filter: vendorFilter });

  console.log('vendor-spatial-core: refreshed vendor/spatial-core, vendor/zod, vendor/h3-js from node_modules.');
}

main();
