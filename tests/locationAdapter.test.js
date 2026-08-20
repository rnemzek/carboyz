import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocationQuery, describeCoordinates } from '../src/adapters/locationAdapter.js';

test('resolveLocationQuery resolves a known 5-digit ZIP', () => {
  const result = resolveLocationQuery('28451');
  assert.deepEqual(result, { lat: 34.2388, lng: -78.0145, label: 'Leland, NC' });
});

test('resolveLocationQuery resolves a known city name, case-insensitively', () => {
  const result = resolveLocationQuery('  Leland  ');
  assert.equal(result.label, 'Leland, NC');
});

test('resolveLocationQuery resolves "City, ST" formatted input', () => {
  const result = resolveLocationQuery('Denver, CO');
  assert.equal(result.label, 'Denver, CO');
});

test('resolveLocationQuery returns null for unrecognized input', () => {
  assert.equal(resolveLocationQuery('Nowhereville, ZZ'), null);
  assert.equal(resolveLocationQuery('00000'), null);
});

test('resolveLocationQuery returns null for empty or non-string input', () => {
  assert.equal(resolveLocationQuery(''), null);
  assert.equal(resolveLocationQuery('   '), null);
  assert.equal(resolveLocationQuery(undefined), null);
});

test('describeCoordinates returns the exact label for a known location', () => {
  assert.equal(describeCoordinates(34.2388, -78.0145), 'Leland, NC');
});

test('describeCoordinates returns a "Near" caption for an approximate fix', () => {
  const label = describeCoordinates(34.3, -78.05);
  assert.equal(label, 'Near Leland, NC');
});

test('describeCoordinates falls back gracefully for non-numeric input', () => {
  assert.equal(describeCoordinates(undefined, undefined), 'Current Location');
});
