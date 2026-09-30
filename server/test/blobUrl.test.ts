import { describe, it, expect } from '@jest/globals';
import { blobPublicOriginFromToken, encodeBlobPathname, publicBlobUrl, validateOptimizerTarget } from '../blobUrl.ts';

describe('blobPublicOriginFromToken', () => {
  it('derives the lowercased public store host from a read-write token', () => {
    expect(blobPublicOriginFromToken('vercel_blob_rw_kFzD7Nj9TzPxRtsw_AbCdEf0123456789')).toBe(
      'https://kfzd7nj9tzpxrtsw.public.blob.vercel-storage.com',
    );
  });

  it('trims surrounding whitespace (e.g. a trailing newline in an env file)', () => {
    expect(blobPublicOriginFromToken('  vercel_blob_rw_Store1_secret\n')).toBe(
      'https://store1.public.blob.vercel-storage.com',
    );
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
    ['wrong prefix', 'vercel_blob_ro_Store1_secret'],
    ['missing secret', 'vercel_blob_rw_Store1'],
    ['missing store id', 'vercel_blob_rw__secret'],
    ['non-alphanumeric store id', 'vercel_blob_rw_st.re_secret'],
    ['arbitrary string', 'not-a-token'],
  ])('returns null for %s', (_label, token) => {
    expect(blobPublicOriginFromToken(token as string | undefined | null)).toBeNull();
  });
});

describe('encodeBlobPathname', () => {
  it('leaves plain path segments untouched', () => {
    expect(encodeBlobPathname('avatars/Season4/BeABetterMan/a_b-c.jpg')).toBe(
      'avatars/Season4/BeABetterMan/a_b-c.jpg',
    );
  });

  it('percent-encodes spaces per segment but keeps the slashes', () => {
    expect(encodeBlobPathname('avatars/S4/Be A Better Man icons/x.jpg')).toBe(
      'avatars/S4/Be%20A%20Better%20Man%20icons/x.jpg',
    );
  });

  it("encodes RFC 3986 reserved chars that encodeURIComponent skips (!'()*)", () => {
    // Matches the real Blob URL for "Black Background (supernova)".
    expect(encodeBlobPathname("a/Black Background (supernova)/it's*!.jpg")).toBe(
      'a/Black%20Background%20%28supernova%29/it%27s%2A%21.jpg',
    );
  });

  it('encodes #, ?, % and non-ASCII so they cannot truncate or corrupt the URL', () => {
    expect(encodeBlobPathname('a/50%#1?.jpg')).toBe('a/50%25%231%3F.jpg');
    expect(encodeBlobPathname('a/café.png')).toBe('a/caf%C3%A9.png');
  });
});

describe('publicBlobUrl', () => {
  const origin = 'https://store1.public.blob.vercel-storage.com';

  it('builds a direct CDN URL when the origin is known', () => {
    expect(publicBlobUrl(origin, 'avatars/S4/My Folder/x (1).jpg')).toBe(
      `${origin}/avatars/S4/My%20Folder/x%20%281%29.jpg`,
    );
  });

  it('falls back to the /avatars redirect path (unencoded, as before) without an origin', () => {
    expect(publicBlobUrl(null, 'avatars/S4/My Folder/x.jpg')).toBe('/avatars/S4/My Folder/x.jpg');
  });
});

describe('validateOptimizerTarget', () => {
  const ok = 'https://store1.public.blob.vercel-storage.com/avatars/S4/a%20b.jpg';

  it('accepts a Blob URL under /avatars/', () => {
    expect(validateOptimizerTarget(ok)).toBe(ok);
  });

  it.each([
    ['non-string', 42],
    ['empty', ''],
    ['unparseable', 'not a url'],
    ['http', 'http://store1.public.blob.vercel-storage.com/avatars/a.jpg'],
    ['foreign host', 'https://evil.example.com/avatars/a.jpg'],
    ['look-alike host suffix', 'https://store1.public.blob.vercel-storage.com.evil.com/avatars/a.jpg'],
    ['nested subdomain', 'https://a.b.public.blob.vercel-storage.com/avatars/a.jpg'],
    ['credentials', 'https://u:p@store1.public.blob.vercel-storage.com/avatars/a.jpg'],
    ['explicit port', 'https://store1.public.blob.vercel-storage.com:8443/avatars/a.jpg'],
    ['path outside /avatars/', 'https://store1.public.blob.vercel-storage.com/private/a.jpg'],
    ['protocol-relative', '//store1.public.blob.vercel-storage.com/avatars/a.jpg'],
  ])('rejects %s', (_label, raw) => {
    expect(validateOptimizerTarget(raw)).toBeNull();
  });
});
