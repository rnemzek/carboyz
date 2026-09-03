import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const testCorePkgDir = join(rootDir, 'node_modules', '@nemzilla', 'test-core');
const vendorDir = join(rootDir, 'vendor', 'test-core');

/**
 * Copies @nemzilla/test-core's src/ into vendor/test-core/ (committed to git), mirroring
 * scripts/vendor-spatial-core.js for the same reason: it's a `file:../test-core` dependency
 * pointing at a sibling directory that only resolves on a developer machine, and this app has no
 * bundler (see index.html's <script type="importmap">). Unlike spatial-core, test-core has no
 * build step and no runtime dependencies of its own, so the raw ESM src/ is vendored directly.
 */
function main() {
  if (!existsSync(testCorePkgDir)) {
    console.log('vendor-test-core: node_modules/@nemzilla/test-core not found, skipping (using committed vendor/).');
    return;
  }

  rmSync(vendorDir, { recursive: true, force: true });
  cpSync(join(testCorePkgDir, 'src'), join(vendorDir, 'src'), { recursive: true });

  console.log('vendor-test-core: refreshed vendor/test-core/src from node_modules.');
}

main();
