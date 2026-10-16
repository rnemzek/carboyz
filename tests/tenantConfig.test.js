import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TENANT_CONFIG,
  DEFAULT_OPERATING_SCHEDULE,
  DEFAULT_DEALERSHIP_COORDINATES,
  createTenantConfig,
  isWithinOperatingHours,
} from '../src/config/tenantConfig.js';

test('createTenantConfig falls back to defaults when called with no overrides', () => {
  const config = createTenantConfig();
  assert.deepEqual(config, DEFAULT_TENANT_CONFIG);
});

test('createTenantConfig merges partial overrides on top of defaults', () => {
  const config = createTenantConfig({ tenantId: 'acme', name: 'Acme Co.' });
  assert.equal(config.tenantId, 'acme');
  assert.equal(config.name, 'Acme Co.');
  assert.deepEqual(config.themeColors, DEFAULT_TENANT_CONFIG.themeColors);
});

test('createTenantConfig merges themeColors instead of replacing them wholesale', () => {
  const config = createTenantConfig({ themeColors: { primary: '#FF0000' } });
  assert.equal(config.themeColors.primary, '#FF0000');
  assert.equal(config.themeColors.secondary, DEFAULT_TENANT_CONFIG.themeColors.secondary);
});

test('createTenantConfig merges contact info instead of replacing it wholesale', () => {
  const config = createTenantConfig({ contact: { phone: '555-0100' } });
  assert.equal(config.contact.phone, '555-0100');
  assert.equal(config.contact.email, DEFAULT_TENANT_CONFIG.contact.email);
});

test('createTenantConfig accepts a tagline override', () => {
  const config = createTenantConfig({ tagline: 'Deals you can trust.' });
  assert.equal(config.tagline, 'Deals you can trust.');
});

test('createTenantConfig defaults iconSet to null', () => {
  const config = createTenantConfig();
  assert.equal(config.iconSet, null);
});

test('createTenantConfig accepts an iconSet override', () => {
  const iconSet = { appleTouchIcon: 'data:apple', manifestIcon192: 'data:192', manifestIcon512: 'data:512' };
  const config = createTenantConfig({ iconSet });
  assert.deepEqual(config.iconSet, iconSet);
});

test('createTenantConfig defaults adminPin to "1234"', () => {
  const config = createTenantConfig();
  assert.equal(config.adminPin, '1234');
});

test('createTenantConfig accepts an adminPin override', () => {
  const config = createTenantConfig({ adminPin: '4321' });
  assert.equal(config.adminPin, '4321');
});

test('createTenantConfig defaults operatingSchedule to DEFAULT_OPERATING_SCHEDULE', () => {
  const config = createTenantConfig();
  assert.deepEqual(config.operatingSchedule, DEFAULT_OPERATING_SCHEDULE);
});

test('createTenantConfig merges operatingSchedule overrides instead of replacing them wholesale', () => {
  const config = createTenantConfig({ operatingSchedule: { nagIntervalMinutes: 30 } });
  assert.equal(config.operatingSchedule.nagIntervalMinutes, 30);
  assert.equal(config.operatingSchedule.openHourLocal, DEFAULT_OPERATING_SCHEDULE.openHourLocal);
});

test('createTenantConfig defaults dealershipCoordinates to the CarBoyZ Leland HQ anchor', () => {
  const config = createTenantConfig();
  assert.deepEqual(config.dealershipCoordinates, DEFAULT_DEALERSHIP_COORDINATES);
  assert.deepEqual(config.dealershipCoordinates, { lat: 34.2388, lng: -78.0145 });
});

test('createTenantConfig merges dealershipCoordinates overrides instead of replacing them wholesale', () => {
  const config = createTenantConfig({ dealershipCoordinates: { lat: 39.74 } });
  assert.equal(config.dealershipCoordinates.lat, 39.74);
  assert.equal(config.dealershipCoordinates.lng, DEFAULT_DEALERSHIP_COORDINATES.lng);
});

test('isWithinOperatingHours is true inside the daytime window and false outside it', () => {
  assert.equal(isWithinOperatingHours(new Date('2026-01-15T13:00:00.000Z'), DEFAULT_OPERATING_SCHEDULE), true); // 8:00 ET
  assert.equal(isWithinOperatingHours(new Date('2026-01-15T12:59:00.000Z'), DEFAULT_OPERATING_SCHEDULE), false); // 7:59 ET
  assert.equal(isWithinOperatingHours(new Date('2026-01-16T01:59:00.000Z'), DEFAULT_OPERATING_SCHEDULE), true); // 20:59 ET
  assert.equal(isWithinOperatingHours(new Date('2026-01-16T02:00:00.000Z'), DEFAULT_OPERATING_SCHEDULE), false); // 21:00 ET
});

test('isWithinOperatingHours treats midnight as quiet hours for a daytime schedule', () => {
  assert.equal(isWithinOperatingHours(new Date('2026-01-15T05:00:00.000Z'), DEFAULT_OPERATING_SCHEDULE), false); // 00:00 ET
});

test('isWithinOperatingHours wraps across midnight for an overnight window', () => {
  const overnight = { ...DEFAULT_OPERATING_SCHEDULE, openHourLocal: 20, closeHourLocal: 6 };
  assert.equal(isWithinOperatingHours(new Date('2026-01-15T05:00:00.000Z'), overnight), true); // 00:00 ET, within 20-6
  assert.equal(isWithinOperatingHours(new Date('2026-01-15T16:00:00.000Z'), overnight), false); // 11:00 ET, outside 20-6
});

test('isWithinOperatingHours resolves the hour in the schedule timeZone, not the runtime zone', () => {
  const sameInstant = new Date('2026-01-15T03:00:00.000Z');
  assert.equal(isWithinOperatingHours(sameInstant, DEFAULT_OPERATING_SCHEDULE), false); // 22:00 ET: closed
  assert.equal(
    isWithinOperatingHours(sameInstant, { ...DEFAULT_OPERATING_SCHEDULE, timeZone: 'America/Los_Angeles' }),
    true, // 19:00 PT: open
  );
});

test('isWithinOperatingHours is always true when the schedule is disabled', () => {
  assert.equal(isWithinOperatingHours(new Date('2026-01-15T05:00:00.000Z'), { ...DEFAULT_OPERATING_SCHEDULE, enabled: false }), true);
});
