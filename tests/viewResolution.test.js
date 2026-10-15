import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, readViewFromUrl, readViewFromPath, resolveActiveView } from '../src/config/viewResolution.js';

test('readViewFromUrl reads a valid ?view= param', () => {
  assert.equal(readViewFromUrl('?view=dealer'), VIEWS.DEALER);
  assert.equal(readViewFromUrl('?view=seller'), VIEWS.SELLER);
});

test('readViewFromUrl returns null for a missing or invalid ?view= param', () => {
  assert.equal(readViewFromUrl(''), null);
  assert.equal(readViewFromUrl('?view=bogus'), null);
  assert.equal(readViewFromUrl('?brand=acme'), null);
});

test('readViewFromPath recognizes /dealer with or without a trailing slash', () => {
  assert.equal(readViewFromPath('/dealer'), VIEWS.DEALER);
  assert.equal(readViewFromPath('/dealer/'), VIEWS.DEALER);
});

test('readViewFromPath returns null for the root or any other path', () => {
  assert.equal(readViewFromPath('/'), null);
  assert.equal(readViewFromPath('/dealers'), null);
  assert.equal(readViewFromPath(''), null);
});

test('resolveActiveView prefers the query param over the path', () => {
  assert.equal(resolveActiveView({ search: '?view=seller', pathname: '/dealer' }), VIEWS.SELLER);
});

test('resolveActiveView falls back to the path when there is no query param', () => {
  assert.equal(resolveActiveView({ search: '', pathname: '/dealer' }), VIEWS.DEALER);
});

test('resolveActiveView defaults to seller when neither the query param nor the path match', () => {
  assert.equal(resolveActiveView({ search: '', pathname: '/' }), VIEWS.SELLER);
  assert.equal(resolveActiveView(), VIEWS.SELLER);
});
