import { createTenantConfig } from './tenantConfig.js';
import { resolveActiveTenantId } from './tenantResolution.js';

export const CARBOYZ_TENANT_ID = 'carboyz';

export const CARBOYZ_FLAGSHIP_PRESET = Object.freeze({
  tenantId: CARBOYZ_TENANT_ID,
  name: 'CarBoyZ Motors',
  tagline: 'Raw Muscle, Badass Trucks, Boss Jeeps & whatever chicks want',
  logoUrl: '',
  themeColors: Object.freeze({
    // StreamZilla dark/gold system: amber-400 gold reads too light for white
    // text, so onPrimary flips header/button text to a near-black slate.
    primary: '#FBBF24',
    secondary: '#334155',
    background: '#020617',
    text: '#F1F5F9',
    surface: '#0F172A',
    border: '#334155',
    onPrimary: '#0F172A',
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
