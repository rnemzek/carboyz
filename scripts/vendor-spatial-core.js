import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const spatialCorePkgDir = join(rootDir, 'node_modules', '@nemzilla', 'spatial-core');
const vendorDir = join(rootDir, 'vendor');

// Runtime ESM .js only. Everything below is categorically inapplicable to a browser importmap in
// this "type": "module" app, not an attempt at tracing which specific files a package's entry point
// actually reaches (that needs a bundler, explicitly out of scope, or fragile manual tracing):
//  - .map/.ts/.d.ts/.cts/.d.cts/.mts/.d.mts: never fetched/executed by a browser (source maps, TS
//    source and declarations in every TS extension flavor — .cts/.mts don't end in plain ".ts")
//  - .cjs: this app never resolves a CommonJS build, only ESM
//  - docs/tests/benchmarks: not code at all
const SKIP_NAME_PATTERNS = [/\.map$/, /\.(d\.)?[cm]?ts$/, /\.cjs$/, /\.md$/i, /^(LICENSE|NOTICE|CHANGELOG|CONTRIBUTING|RELEASE)/i];
const SKIP_DIR_NAMES = new Set(['test', 'tests', 'benchmark', 'benchmarks', '.github', 'src']);

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
