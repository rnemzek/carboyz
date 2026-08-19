import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBrandInitials } from '../src/ui/branding.js';

test('getBrandInitials combines the first letters of the first two words', () => {
  assert.equal(getBrandInitials('Carboyz Motors'), 'CM');
  assert.equal(getBrandInitials('Summit Auto Group'), 'SA');
});

test('getBrandInitials takes the first two letters of a single-word name', () => {
  assert.equal(getBrandInitials('Carboyz'), 'CA');
});

test('getBrandInitials returns an empty string for blank or whitespace-only input', () => {
  assert.equal(getBrandInitials(''), '');
  assert.equal(getBrandInitials('   '), '');
  assert.equal(getBrandInitials(), '');
});

test('getBrandInitials ignores extra internal whitespace', () => {
  assert.equal(getBrandInitials('  Harbor   Motors  '), 'HM');
});

test('getBrandInitials prefers embedded capitalization over word-splitting for stylized brand names', () => {
  assert.equal(getBrandInitials('CarBoyZ Motors'), 'CB');
  assert.equal(getBrandInitials('CarBoyZ'), 'CB');
});

test('getBrandInitials ignores digits and symbols when scanning for capitals, falling back to the first word', () => {
  // Only one real capital letter ('M') in "4x4 Motors", so it falls back to the first two
  // characters of the first word rather than pairing across the space.
  assert.equal(getBrandInitials('4x4 Motors'), '4X');
});
