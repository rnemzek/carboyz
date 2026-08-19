export { DEFAULT_TENANT_CONFIG, createTenantConfig } from '../config/tenantConfig.js';
export { TenantRegistry, CARBOYZ_TENANT_ID, CARBOYZ_FLAGSHIP_PRESET } from '../config/TenantRegistry.js';
export {
  TENANT_STORAGE_KEY,
  readTenantIdFromUrl,
  readTenantIdFromStorage,
  writeTenantIdToStorage,
  resolveActiveTenantId,
} from '../config/tenantResolution.js';
export { HapticsService } from '../services/HapticsService.js';
export { ShareService } from '../services/ShareService.js';
export { TelemetryService, MarketPosition } from '../services/TelemetryService.js';
export { SearchService } from '../services/SearchService.js';
export { IngestService } from '../services/IngestService.js';
export { DiscoveryService, DiscoveryStage } from '../services/DiscoveryService.js';
export { VendorAdapter } from '../adapters/VendorAdapter.js';
export { Dealer } from '../models/Dealer.js';
export { Vehicle } from '../models/Vehicle.js';
export { haversineDistanceMiles } from '../utils/geo.js';
export {
  SEED_ZIP_CODE,
  SEED_ANCHOR,
  CARBOYZ_HQ_DEALER_ID,
  DIRECT_INVENTORY,
  VENDOR_FEEDS as CARBOYZ_VENDOR_FEEDS,
  seedDirectInventory,
} from '../utils/seedInventory.js';
