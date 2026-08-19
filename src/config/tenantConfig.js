const DEFAULT_THEME_COLORS = Object.freeze({
  primary: '#0057D9',
  secondary: '#1B1F27',
  background: '#FFFFFF',
  text: '#111318',
});

const DEFAULT_CONTACT = Object.freeze({
  phone: '',
  email: '',
});

export const DEFAULT_TENANT_CONFIG = Object.freeze({
  tenantId: 'default',
  name: 'Carboyz',
  tagline: '',
  logoUrl: '',
  themeColors: DEFAULT_THEME_COLORS,
  contact: DEFAULT_CONTACT,
});

export function createTenantConfig(overrides = {}) {
  return {
    ...DEFAULT_TENANT_CONFIG,
    ...overrides,
    themeColors: {
      ...DEFAULT_TENANT_CONFIG.themeColors,
      ...(overrides.themeColors ?? {}),
    },
    contact: {
      ...DEFAULT_TENANT_CONFIG.contact,
      ...(overrides.contact ?? {}),
    },
  };
}
