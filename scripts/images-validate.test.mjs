import { test } from 'node:test';
import assert from 'node:assert/strict';

import { findProblems } from './images-validate.mjs';

// A well-formed registry + id-keyed attribution table fixture.
function validFixture() {
  const images = {
    'id-1': { blobPath: 'avatars/S4/Camp/a.jpg', status: 'active' },
    'id-2': { blobPath: 'avatars/S4/Camp/b.jpg', status: 'active' },
    'id-3': { blobPath: 'avatars/S4/Camp/c.jpg', status: 'deleted' },
  };
  const attribution = {
    'id-1': { handle: '@X', confidence: 'high' },
    'id-2': { handle: null, confidence: 'unresolved' },
  };
  return { images, attribution };
}

test('findProblems: clean registry returns no problems', () => {
  const { images, attribution } = validFixture();
  assert.deepEqual(findProblems(images, attribution), []);
});

test('findProblems: flags an attribution key with no registry entry', () => {
  const { images, attribution } = validFixture();
  attribution['id-missing'] = { handle: '@Y', confidence: 'high' };
  const problems = findProblems(images, attribution);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /attribution key has no registry entry: id-missing/);
});

test('findProblems: flags a duplicate blobPath across two ids', () => {
  const { images, attribution } = validFixture();
  images['id-dup'] = { blobPath: 'avatars/S4/Camp/a.jpg', status: 'active' };
  const problems = findProblems(images, attribution);
  assert.ok(problems.some((p) => /duplicate blobPath avatars\/S4\/Camp\/a\.jpg/.test(p)));
});

test('findProblems: flags an invalid status and a missing blobPath', () => {
  const images = {
    'id-1': { blobPath: 'avatars/x.jpg', status: 'archived' }, // invalid status
    'id-2': { status: 'active' }, // missing blobPath
  };
  const problems = findProblems(images, {});
  assert.ok(problems.some((p) => /invalid status "archived"/.test(p)));
  assert.ok(problems.some((p) => /image id-2: missing blobPath/.test(p)));
});

test('findProblems: flags a non-object registry record', () => {
  const images = { 'id-1': null, 'id-2': 'oops' };
  const problems = findProblems(images, {});
  assert.ok(problems.some((p) => /image id-1: not an object/.test(p)));
  assert.ok(problems.some((p) => /image id-2: not an object/.test(p)));
});

test('findProblems: flags a still-blob-path-keyed attribution table', () => {
  const images = { 'id-1': { blobPath: 'avatars/a.jpg', status: 'active' } };
  // Pre-migration shape: keys are blob paths, not ids.
  const attribution = { 'avatars/a.jpg': { handle: '@X', confidence: 'high' } };
  const problems = findProblems(images, attribution);
  assert.ok(problems.some((p) => /still blob-path-keyed/.test(p)));
});

test('findProblems: --check-blob flags an active image whose blob is missing', () => {
  const { images, attribution } = validFixture();
  // Only id-1's blob is present; id-2 (active) is missing; id-3 is deleted (ignored).
  const present = new Set(['avatars/S4/Camp/a.jpg']);
  const problems = findProblems(images, attribution, present);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /image id-2: blob missing in storage/);
});

test('findProblems: --check-blob ignores deleted records', () => {
  const images = {
    'id-3': { blobPath: 'avatars/gone.jpg', status: 'deleted' },
  };
  // gone.jpg is not present, but the record is deleted, so no problem.
  const problems = findProblems(images, {}, new Set());
  assert.deepEqual(problems, []);
});
