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
  generateId,
  isImageFile,
  loadCampaigns,
  loadImages,
  loadAttribution,
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

test('generateId returns distinct RFC 4122 v4 UUIDs', () => {
  const a = generateId();
  const b = generateId();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
});

test('isImageFile accepts supported extensions case-insensitively', () => {
  for (const p of ['a.png', 'a.JPG', 'dir/a.jpeg', 'a.GIF', 'a.webp', 'a.avif', 'a.bmp', 'a.svg']) {
    assert.equal(isImageFile(p), true, p);
  }
  for (const p of ['a.txt', 'a', 'a.png.bak', 'png', 'dir.png/readme.md']) {
    assert.equal(isImageFile(p), false, p);
  }
});

test('campaignSlug falls through empty / non-alphanumeric candidates and returns null when none usable', () => {
  assert.equal(campaignSlug({ id: '   ', hashtag: '@@@', icon_path: 'Season4/Foo Bar' }), 'season4-foo-bar');
  assert.equal(campaignSlug({ id: 42, hashtag: 'Real' }), 'real');
  assert.equal(campaignSlug({ id: '!!!', hashtag: '', icon_path: '***' }), null);
  assert.equal(campaignSlug({}), null);
});

test('deriveCampaignId: trailing-slash icon_path, exact match, sibling-prefix and missing icon_path', () => {
  const campaigns = [
    { hashtag: 'Slash', icon_path: 'Season1/Slash/' },
    { hashtag: 'Pilot', icon_path: 'Season1/Pilot' },
    { hashtag: 'NoIcon' },
  ];
  assert.equal(deriveCampaignId('avatars/Season1/Slash/a.png', campaigns), 'slash');
  assert.equal(deriveCampaignId('avatars/Season1/Pilot', campaigns), 'pilot');
  // "Season1/PilotExtra" must not match the "Season1/Pilot" campaign.
  assert.equal(deriveCampaignId('avatars/Season1/PilotExtra/a.png', campaigns), null);
  // Paths without the avatars/ prefix are matched as-is.
  assert.equal(deriveCampaignId('Season1/Pilot/a.png', campaigns), 'pilot');
  assert.equal(deriveCampaignId('avatars/x.png', []), null);
});

test('splitBlobPath with no matching campaign puts the whole directory into artistFolder', () => {
  assert.deepEqual(splitBlobPath('avatars/Unknown/Deep/Dir/f.png', CAMPAIGNS), {
    iconPath: '',
    artistFolder: 'Unknown/Deep/Dir',
    fileName: 'f.png',
  });
  assert.deepEqual(splitBlobPath('avatars/f.png', CAMPAIGNS), {
    iconPath: '',
    artistFolder: '',
    fileName: 'f.png',
  });
});

test('splitBlobPath prefers the longest (nested) icon_path', () => {
  assert.deepEqual(splitBlobPath('avatars/Season4/AcrossTheUniverse/Special/A/f.png', CAMPAIGNS), {
    iconPath: 'Season4/AcrossTheUniverse/Special',
    artistFolder: 'A',
    fileName: 'f.png',
  });
});

test('resolveIconPath returns "" for a campaign matched by id that has no icon_path', () => {
  assert.equal(resolveIconPath('noicon', [{ id: 'NoIcon' }]), '');
});

test('buildBlobPathIndex skips null / malformed records and indexes the rest', () => {
  const index = buildBlobPathIndex({
    'id-null': null,
    'id-nopath': { size: 1 },
    'id-num': { blobPath: 42 },
    'id-ok': { blobPath: 'avatars/ok.png' },
  });
  assert.deepEqual([...index.entries()], [['avatars/ok.png', 'id-ok']]);
});

test('buildBlobPath ignores non-string segments', () => {
  assert.equal(
    buildBlobPath({ iconPath: 'S/X', artistFolder: undefined, fileName: 'a.png' }),
    'avatars/S/X/a.png'
  );
  assert.equal(buildBlobPath({ iconPath: null, artistFolder: '  ', fileName: 'a.png' }), 'avatars/a.png');
});

test('makeImageRecord normalizes missing optional fields to null', () => {
  const rec = makeImageRecord({ blobPath: 'avatars/a.png', size: '12' });
  assert.equal(rec.contentHash, null);
  assert.equal(rec.size, null);
  assert.equal(rec.campaignId, null);
  assert.equal(rec.status, 'active');
  assert.match(rec.addedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(rec.addedAt, rec.updatedAt);
});

// Read-only smoke tests against the committed data files: the loaders must
// return plain objects/arrays and the registry must be internally consistent
// with the attribution table's keying.
test('loadCampaigns returns the campaigns array from data/campaigns.yaml', () => {
  const campaigns = loadCampaigns();
  assert.ok(Array.isArray(campaigns));
  assert.ok(campaigns.length > 0);
  for (const c of campaigns) assert.notEqual(campaignSlug(c), null);
});

test('loadImages / loadAttribution return objects and attribution is id-keyed', () => {
  const images = loadImages();
  const attribution = loadAttribution();
  assert.equal(typeof images, 'object');
  assert.equal(Array.isArray(images), false);
  assert.equal(typeof attribution, 'object');
  assert.equal(isBlobPathKeyed(attribution), false);
  // Building the index over the committed registry must not throw.
  const index = buildBlobPathIndex(images);
  assert.equal(index.size, Object.keys(images).length);
});
