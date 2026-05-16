import { describe, it, expect } from 'vitest';
import { extractImdbId } from '../src/utils/extractImdbId';

describe('extractImdbId', () => {
  it('extracts tt id from a standard imdb title URL', () => {
    expect(extractImdbId('http://www.imdb.com/title/tt2125636/')).toBe('tt2125636');
  });

  it('extracts tt id when the URL has no trailing slash', () => {
    expect(extractImdbId('https://imdb.com/title/tt2080688')).toBe('tt2080688');
  });

  it('extracts tt id when the URL has a query string', () => {
    expect(extractImdbId('https://imdb.com/title/tt2080688?ref_=fn_al_tt_1')).toBe('tt2080688');
  });

  it('returns null for non-imdb URLs', () => {
    expect(extractImdbId('https://example.com/foo/bar')).toBeNull();
  });

  it('returns null for empty / null / undefined / non-string input', () => {
    expect(extractImdbId('')).toBeNull();
    expect(extractImdbId(null)).toBeNull();
    expect(extractImdbId(undefined)).toBeNull();
    // @ts-expect-error - exercising runtime guard
    expect(extractImdbId(42)).toBeNull();
  });
});
