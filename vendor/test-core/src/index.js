// Browser-safe domain logic only. Node-only CLI utilities (fs/path-dependent file generators)
// live under ./node/ and must be imported directly (e.g. by bin/mine-pdfs.js), never re-exported
// here, so this entry point stays free of `node:fs` / `node:path` for browser consumers.
export { generateVin, calculateCheckDigit, isValidVin } from './vin/generator.js';
export { decodeVIN } from './vin/nhtsa.js';
export { VEHICLE_SEEDS, findVehicleSeed } from './presets/vehicle-seeds.js';
export { generateMockOffer, SUPPORTED_COMPETITORS } from './document/mock-offer.js';
