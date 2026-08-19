import { createTenantConfig } from './tenantConfig.js';
import { resolveActiveTenantId } from './tenantResolution.js';

export const CARBOYZ_TENANT_ID = 'carboyz';

export const CARBOYZ_FLAGSHIP_PRESET = Object.freeze({
  tenantId: CARBOYZ_TENANT_ID,
  name: 'CarBoyZ Motors',
  tagline: 'Raw Muscle, Local Trucks & Saturday Project Builds',
  logoUrl: '',
  themeColors: Object.freeze({
    // Deeper amber-600 (vs. a lighter amber-500) so white header/button text
    // stays readable against it, while still reading unmistakably as amber.
    primary: '#D97706',
    secondary: '#B91C1C',
    background: '#161311',
    text: '#F5EAE0',
  }),
  contact: Object.freeze({ phone: '(910) 555-0128', email: 'hello@carboyzmotors.example' }),
});

export class TenantRegistry {
  constructor(presets = []) {
    this.presetsById = new Map();
    presets.forEach((preset) => this.register(preset));
  }

  register(preset) {
    if (!preset || !preset.tenantId) {
      throw new Error('TenantRegistry: a preset requires a tenantId');
    }
    this.presetsById.set(preset.tenantId, createTenantConfig(preset));
  }

  has(tenantId) {
    return this.presetsById.has(tenantId);
  }

  get(tenantId) {
    return this.presetsById.get(tenantId) ?? null;
  }

  list() {
    return [...this.presetsById.values()];
  }

  resolveTenant({ search = '', storage = null, defaultTenantId = null } = {}) {
    const tenantId = resolveActiveTenantId({ search, storage, defaultTenantId });
    return this.get(tenantId) ?? this.get(defaultTenantId) ?? createTenantConfig();
  }
}
