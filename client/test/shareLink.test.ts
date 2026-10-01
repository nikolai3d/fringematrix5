import { describe, it, expect } from 'vitest';
import {
  buildImageShareUrl,
  readSharedImageParam,
  stripSharedImageParam,
  findSharedImageIndex,
  SHARE_IMAGE_PARAM,
} from '../src/utils/shareLink';

describe('buildImageShareUrl', () => {
  it('prefers the permanent image id and keeps path + hash', () => {
    const url = buildImageShareUrl('https://fringematrix.art/#crosstheline', { id: 'abc-123', src: 'https://cdn/x.jpg' });
    expect(url).toBe('https://fringematrix.art/?img=abc-123#crosstheline');
  });

  it('falls back to src when the image has no id', () => {
    const url = buildImageShareUrl('https://fm.art/#c', { id: null, src: 'https://cdn/a b.jpg' });
    const parsed = new URL(url!);
    expect(parsed.searchParams.get(SHARE_IMAGE_PARAM)).toBe('https://cdn/a b.jpg');
    expect(parsed.hash).toBe('#c');
  });

  it('replaces an existing img param instead of appending a second one', () => {
    const url = buildImageShareUrl('https://fm.art/?img=old&x=1#c', { id: 'new', src: 's' });
    const parsed = new URL(url!);
    expect(parsed.searchParams.getAll('img')).toEqual(['new']);
    expect(parsed.searchParams.get('x')).toBe('1');
  });

  it('points author-mode links at the image\'s source campaign gallery', () => {
    const url = buildImageShareUrl('https://fm.art/#authors/%40artist', {
      id: 'img-1',
      src: 'https://cdn/x.jpg',
      campaignId: 'crosstheline',
    });
    expect(url).toBe('https://fm.art/?img=img-1#crosstheline');
  });

  it('falls back to src in author mode when the image has no id', () => {
    const url = buildImageShareUrl('https://fm.art/#authors/%40artist', {
      id: null,
      src: 'https://cdn/x.jpg',
      campaignId: 'crosstheline',
    });
    const parsed = new URL(url!);
    expect(parsed.searchParams.get(SHARE_IMAGE_PARAM)).toBe('https://cdn/x.jpg');
    expect(parsed.hash).toBe('#crosstheline');
  });

  it('returns null when there is nothing to identify the image by', () => {
    expect(buildImageShareUrl('https://fm.art/', { id: null, src: null })).toBeNull();
  });
});

describe('readSharedImageParam', () => {
  it('reads and trims the img param', () => {
    expect(readSharedImageParam('?img=%20abc%20')).toBe('abc');
    expect(readSharedImageParam('?a=1&img=xyz')).toBe('xyz');
  });

  it('returns null when absent or blank', () => {
    expect(readSharedImageParam('')).toBeNull();
    expect(readSharedImageParam('?a=1')).toBeNull();
    expect(readSharedImageParam('?img=')).toBeNull();
    expect(readSharedImageParam('?img=%20')).toBeNull();
  });

  it('round-trips a URL produced by buildImageShareUrl', () => {
    const src = 'https://s.public.blob.vercel-storage.com/avatars/S4/A%20B/x.jpg';
    const url = new URL(buildImageShareUrl('https://fm.art/#c', { src })!);
    expect(readSharedImageParam(url.search)).toBe(src);
  });
});

describe('stripSharedImageParam', () => {
  it('removes img and keeps other params', () => {
    expect(stripSharedImageParam('?img=abc&utm=x')).toBe('?utm=x');
  });
  it('returns an empty string when nothing remains', () => {
    expect(stripSharedImageParam('?img=abc')).toBe('');
    expect(stripSharedImageParam('')).toBe('');
  });
});

describe('findSharedImageIndex', () => {
  const images = [
    { id: 'id-a', src: 'https://cdn/a.jpg', blobPath: 'avatars/a.jpg' },
    { id: null, src: 'https://cdn/b.jpg', blobPath: 'avatars/b.jpg' },
    { id: 'id-c', src: 'https://cdn/c.jpg', blobPath: 'avatars/c.jpg' },
  ];

  it('matches by id', () => {
    expect(findSharedImageIndex(images, 'id-c')).toBe(2);
  });
  it('matches legacy src-based links', () => {
    expect(findSharedImageIndex(images, 'https://cdn/b.jpg')).toBe(1);
  });
  it('matches by blob path', () => {
    expect(findSharedImageIndex(images, 'avatars/c.jpg')).toBe(2);
  });
  it('returns -1 for no match, null input, or empty lists', () => {
    expect(findSharedImageIndex(images, 'nope')).toBe(-1);
    expect(findSharedImageIndex(images, null)).toBe(-1);
    expect(findSharedImageIndex([], 'id-a')).toBe(-1);
  });
  it('never matches a null id against a null-ish value', () => {
    expect(findSharedImageIndex([{ id: null, src: null }], '')).toBe(-1);
  });
});
