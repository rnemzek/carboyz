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

export const DEFAULT_ADMIN_PIN = '1234';

// Desk "quiet hours" gate (UOW-50): outside this window, an unreviewed-lead nag is queued
// for the next morning digest instead of firing an immediate SMS.
export const DEFAULT_OPERATING_SCHEDULE = Object.freeze({
  enabled: true,
  openHourLocal: 8,
  closeHourLocal: 21,
  timeZone: 'America/New_York',
  nagIntervalMinutes: 15,
});

// Acquisition Radar HQ anchor (UOW-52): the dealership center pin and range rings default here
// when a tenant hasn't configured its own dealershipCoordinates — the CarBoyZ Leland HQ.
export const DEFAULT_DEALERSHIP_COORDINATES = Object.freeze({ lat: 34.2526, lng: -78.0383 });

export const DEFAULT_TENANT_CONFIG = Object.freeze({
  tenantId: 'default',
  name: 'Carboyz',
  tagline: '',
  logoUrl: '',
  iconSet: null,
  themeColors: DEFAULT_THEME_COLORS,
  contact: DEFAULT_CONTACT,
  adminPin: DEFAULT_ADMIN_PIN,
  operatingSchedule: DEFAULT_OPERATING_SCHEDULE,
  dealershipCoordinates: DEFAULT_DEALERSHIP_COORDINATES,
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
    operatingSchedule: {
      ...DEFAULT_TENANT_CONFIG.operatingSchedule,
      ...(overrides.operatingSchedule ?? {}),
    },
    dealershipCoordinates: {
      ...DEFAULT_TENANT_CONFIG.dealershipCoordinates,
      ...(overrides.dealershipCoordinates ?? {}),
    },
  };
}

/**
 * Evaluates whether `date` falls inside `schedule`'s local operating window, resolving the hour
 * in `schedule.timeZone` rather than the runtime's own zone. Handles an overnight window (close
 * hour <= open hour, e.g. open 20 / close 6) by wrapping across midnight.
 */
export function isWithinOperatingHours(date, schedule = DEFAULT_OPERATING_SCHEDULE) {
  if (!schedule?.enabled) {
    return true;
  }

  const { openHourLocal, closeHourLocal, timeZone } = schedule;
  if (openHourLocal === closeHourLocal) {
    return true;
  }

  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(date),
  );

  if (openHourLocal < closeHourLocal) {
    return hour >= openHourLocal && hour < closeHourLocal;
  }
  return hour >= openHourLocal || hour < closeHourLocal;
}
