import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildResponsiveThumbnail,
  THUMBNAIL_SRCSET_WIDTHS,
} from '../src/utils/responsiveImage';

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

  it('uses only widths that are declared in the vercel.json images.sizes allow-list', () => {
    // Guards against asking the optimizer for a width it will 404 on. The
    // canonical list lives in vercel.json; this mirrors it so the two stay in
    // sync (update both together).
    const allowedSizes = [160, 320, 480, 640, 960];
    for (const w of THUMBNAIL_SRCSET_WIDTHS) {
      expect(allowedSizes).toContain(w);
    }
  });
});
