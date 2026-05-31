import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildResponsiveThumbnail,
  THUMBNAIL_SRCSET_WIDTHS,
  THUMBNAIL_QUALITY,
} from '../src/utils/responsiveImage';
// Import the real deployment config so the allow-list guards below catch any
// drift between the optimizer params we request and what vercel.json permits.
import vercelConfig from '../../vercel.json';

const BLOB_URL =
  'https://abc123.public.blob.vercel-storage.com/avatars/Season4/Ep/cool-avatar.jpg';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildResponsiveThumbnail — optimization unavailable (dev/test default)', () => {
  it('returns only the original src when import.meta.env.PROD is false', () => {
    // Vitest runs with PROD=false by default, so optimization is off.
    const result = buildResponsiveThumbnail(BLOB_URL, 220);
    expect(result.src).toBe(BLOB_URL);
    expect(result.srcSet).toBeUndefined();
    expect(result.sizes).toBeUndefined();
  });
});

describe('buildResponsiveThumbnail — optimization available (production)', () => {
  it('builds a /_vercel/image srcset + sizes for a Blob URL', () => {
    vi.stubEnv('PROD', true);
    const result = buildResponsiveThumbnail(BLOB_URL, 220);

    expect(result.src).toBe(BLOB_URL);
    expect(result.sizes).toBe('220px');
    expect(result.srcSet).toBeDefined();

    // One candidate per configured width, each pointing at the optimizer with
    // the encoded source URL, a width, a quality, and the `w` descriptor.
    const entries = result.srcSet!.split(', ');
    expect(entries).toHaveLength(THUMBNAIL_SRCSET_WIDTHS.length);
    for (let i = 0; i < THUMBNAIL_SRCSET_WIDTHS.length; i++) {
      const w = THUMBNAIL_SRCSET_WIDTHS[i];
      expect(entries[i]).toBe(
        `/_vercel/image?url=${encodeURIComponent(BLOB_URL)}&w=${w}&q=75 ${w}w`,
      );
    }
  });

  it('rounds the sizes value and falls back to the smallest width for invalid sizes', () => {
    vi.stubEnv('PROD', true);
    expect(buildResponsiveThumbnail(BLOB_URL, 159.6).sizes).toBe('160px');
    expect(buildResponsiveThumbnail(BLOB_URL, 0).sizes).toBe(`${THUMBNAIL_SRCSET_WIDTHS[0]}px`);
    expect(buildResponsiveThumbnail(BLOB_URL, NaN).sizes).toBe(`${THUMBNAIL_SRCSET_WIDTHS[0]}px`);
  });

  it('does NOT rewrite non-Blob URLs (relative fixtures, other hosts)', () => {
    vi.stubEnv('PROD', true);
    // Relative test fixture URL.
    expect(buildResponsiveThumbnail('/avatars/x.png', 220)).toEqual({ src: '/avatars/x.png' });
    // Unrelated absolute host.
    const other = 'https://cdn.example.com/x.png';
    expect(buildResponsiveThumbnail(other, 220)).toEqual({ src: other });
    // http (non-https) Blob-like host is rejected.
    const insecure = 'http://abc.public.blob.vercel-storage.com/avatars/x.png';
    expect(buildResponsiveThumbnail(insecure, 220)).toEqual({ src: insecure });
  });

  it('returns only src for an empty source', () => {
    vi.stubEnv('PROD', true);
    expect(buildResponsiveThumbnail('', 220)).toEqual({ src: '' });
  });

  it('only requests widths declared in the real vercel.json images.sizes allow-list', () => {
    // Reads the actual vercel.json (not a hardcoded copy) so the optimizer
    // never gets asked for a width it will 404 on. Catches drift if either the
    // constant or vercel.json changes without the other.
    const allowedSizes = vercelConfig.images.sizes;
    for (const w of THUMBNAIL_SRCSET_WIDTHS) {
      expect(allowedSizes).toContain(w);
    }
  });

  it('only requests a quality declared in the real vercel.json images.qualities allow-list', () => {
    // Same drift guard for the quality param: the optimizer 404s a quality not
    // listed in images.qualities.
    expect(vercelConfig.images.qualities).toContain(THUMBNAIL_QUALITY);
  });

  it('does NOT rewrite a Blob-host URL whose path is outside /avatars/', () => {
    vi.stubEnv('PROD', true);
    // vercel.json remotePatterns only whitelists pathname ^/avatars/.*$, so a
    // Blob URL outside /avatars/ must fall back to the plain src (no srcset)
    // rather than emit an optimizer URL that would 404.
    const outside = 'https://abc123.public.blob.vercel-storage.com/other/x.jpg';
    expect(buildResponsiveThumbnail(outside, 220)).toEqual({ src: outside });
  });
});
