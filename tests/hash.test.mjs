import test from 'node:test';
import assert from 'node:assert/strict';

import { buildHash, parseHashTarget } from '../js/hash.js';

test('parseHashTarget reads plain and encoded fragments', () => {
  assert.equal(parseHashTarget('#capitulo-2'), 'capitulo-2');
  assert.equal(parseHashTarget('#cap%C3%ADtulo-2'), 'capítulo-2');
  assert.equal(parseHashTarget('capitulo-2'), 'capitulo-2');
});

test('parseHashTarget ignores empty fragments and tolerates malformed encoding', () => {
  assert.equal(parseHashTarget(''), '');
  assert.equal(parseHashTarget('#'), '');
  assert.equal(parseHashTarget(undefined), '');
  assert.equal(parseHashTarget('#%E0%A4%A'), '%E0%A4%A');
});

test('buildHash produces safe fragments and round-trips with parseHashTarget', () => {
  assert.equal(buildHash('document-title'), '#document-title');
  assert.equal(buildHash('capítulo 2'), '#cap%C3%ADtulo%202');
  assert.equal(buildHash(''), '');
  assert.equal(buildHash(undefined), '');
  assert.equal(parseHashTarget(buildHash('capítulo 2')), 'capítulo 2');
});
