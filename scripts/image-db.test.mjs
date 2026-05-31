import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  slugify,
  campaignSlug,
  deriveCampaignId,
  buildBlobPath,
  splitBlobPath,
  resolveIconPath,
  isBlobPathKeyed,
  rekeyAttribution,
  buildBlobPathIndex,
  hashBytes,
  makeImageRecord,
} from './lib/image-db.mjs';

const CAMPAIGNS = [
  { hashtag: 'AcrossTheUniverse', icon_path: 'Season4/AcrossTheUniverse' },
  { hashtag: 'CrossTheLine', icon_path: 'Season4/CrossTheLine' },
  // Nested icon_path to exercise longest-prefix matching.
  { hashtag: 'Special', icon_path: 'Season4/AcrossTheUniverse/Special' },
];

test('slugify matches the server algorithm', () => {
  assert.equal(slugify('CrossTheLine'), 'crosstheline');
  assert.equal(slugify('  Hello World!! '), 'hello-world');
  assert.equal(slugify('@@@!!!'), '');
});

test('campaignSlug prefers id, then hashtag, then icon_path', () => {
  assert.equal(campaignSlug({ id: 'Foo', hashtag: 'Bar' }), 'foo');
  assert.equal(campaignSlug({ hashtag: 'Bar', icon_path: 'x/Baz' }), 'bar');
  assert.equal(campaignSlug({ icon_path: 'x/Baz' }), 'x-baz');
  assert.equal(campaignSlug({}), null);
});

test('deriveCampaignId matches the longest icon_path prefix', () => {
  assert.equal(
    deriveCampaignId('avatars/Season4/CrossTheLine/artist/a.jpg', CAMPAIGNS),
    'crosstheline'
  );
  // Nested folder should win over its parent campaign.
  assert.equal(
    deriveCampaignId('avatars/Season4/AcrossTheUniverse/Special/b.jpg', CAMPAIGNS),
    'special'
  );
  assert.equal(
    deriveCampaignId('avatars/Season4/AcrossTheUniverse/ATU-Foo/c.jpg', CAMPAIGNS),
    'acrosstheuniverse'
  );
  assert.equal(deriveCampaignId('avatars/Unknown/x.jpg', CAMPAIGNS), null);
});

test('buildBlobPath joins and drops empty segments', () => {
  assert.equal(
    buildBlobPath({ iconPath: 'Season4/X', artistFolder: 'Artist', fileName: 'a.jpg' }),
    'avatars/Season4/X/Artist/a.jpg'
  );
  assert.equal(
    buildBlobPath({ iconPath: 'Season4/X', artistFolder: '', fileName: 'a.jpg' }),
    'avatars/Season4/X/a.jpg'
  );
  assert.equal(
    buildBlobPath({ iconPath: '/Season4/X/', fileName: 'a.jpg' }),
    'avatars/Season4/X/a.jpg'
  );
});

test('splitBlobPath is the inverse of buildBlobPath', () => {
  const blobPath = 'avatars/Season4/CrossTheLine/ArtistFolder/file.jpg';
  const parts = splitBlobPath(blobPath, CAMPAIGNS);
  assert.deepEqual(parts, {
    iconPath: 'Season4/CrossTheLine',
    artistFolder: 'ArtistFolder',
    fileName: 'file.jpg',
  });
  assert.equal(buildBlobPath(parts), blobPath);
});

test('splitBlobPath handles no artist folder', () => {
  const parts = splitBlobPath('avatars/Season4/CrossTheLine/file.jpg', CAMPAIGNS);
  assert.deepEqual(parts, {
    iconPath: 'Season4/CrossTheLine',
    artistFolder: '',
    fileName: 'file.jpg',
  });
});

test('resolveIconPath accepts derived id or raw icon_path', () => {
  assert.equal(resolveIconPath('crosstheline', CAMPAIGNS), 'Season4/CrossTheLine');
  assert.equal(resolveIconPath('Season4/CrossTheLine', CAMPAIGNS), 'Season4/CrossTheLine');
  assert.equal(resolveIconPath('nope', CAMPAIGNS), null);
});

test('isBlobPathKeyed distinguishes pre/post migration tables', () => {
  assert.equal(isBlobPathKeyed({ 'avatars/x/y.jpg': {} }), true);
  assert.equal(isBlobPathKeyed({ '00419c07-3c95-4526-acd9-61579958aebe': {} }), false);
  assert.equal(isBlobPathKeyed({}), false);
});

test('rekeyAttribution maps blob paths to ids and reports unmapped', () => {
  const attribution = {
    'avatars/a.jpg': { handle: '@A' },
    'avatars/b.jpg': { handle: '@B' },
    'avatars/missing.jpg': { handle: '@C' },
  };
  const index = new Map([
    ['avatars/a.jpg', 'id-a'],
    ['avatars/b.jpg', 'id-b'],
  ]);
  const { attribution: out, unmapped } = rekeyAttribution(attribution, index);
  assert.deepEqual(out, { 'id-a': { handle: '@A' }, 'id-b': { handle: '@B' } });
  assert.deepEqual(unmapped, ['avatars/missing.jpg']);
});

test('buildBlobPathIndex throws on duplicate blobPath', () => {
  const images = {
    'id-1': { blobPath: 'avatars/x.jpg' },
    'id-2': { blobPath: 'avatars/x.jpg' },
  };
  assert.throws(() => buildBlobPathIndex(images), /Duplicate blobPath/);
});

test('hashBytes is deterministic and sha256-prefixed', () => {
  const a = hashBytes(Buffer.from('hello'));
  const b = hashBytes(Buffer.from('hello'));
  assert.equal(a, b);
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(a, hashBytes(Buffer.from('world')));
});

test('makeImageRecord stamps the expected shape', () => {
  const now = '2026-05-28T00:00:00.000Z';
  const rec = makeImageRecord({
    blobPath: 'avatars/x.jpg',
    contentHash: 'sha256:abc',
    size: 42,
    campaignId: 'crosstheline',
    now,
  });
  assert.deepEqual(rec, {
    blobPath: 'avatars/x.jpg',
    contentHash: 'sha256:abc',
    size: 42,
    campaignId: 'crosstheline',
    status: 'active',
    addedAt: now,
    updatedAt: now,
  });
  // Nullable fields default to null.
  const sparse = makeImageRecord({ blobPath: 'avatars/y.jpg', now });
  assert.equal(sparse.contentHash, null);
  assert.equal(sparse.size, null);
  assert.equal(sparse.campaignId, null);
});
