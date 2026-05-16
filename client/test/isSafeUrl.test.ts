import { describe, it, expect } from 'vitest';
import { isSafeUrl } from '../src/utils/isSafeUrl';

describe('isSafeUrl', () => {
  it('returns true for https:// URLs', () => {
    expect(isSafeUrl('https://www.imdb.com/title/tt2125636/')).toBe(true);
    expect(isSafeUrl('https://example.com')).toBe(true);
  });

  it('returns true for http:// URLs', () => {
    expect(isSafeUrl('http://www.imdb.com/title/tt2080688')).toBe(true);
    expect(isSafeUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('is case-insensitive for the scheme', () => {
    expect(isSafeUrl('HTTPS://example.com')).toBe(true);
    expect(isSafeUrl('HTTP://example.com')).toBe(true);
    expect(isSafeUrl('Https://example.com')).toBe(true);
  });

  it('returns false for javascript: URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('javascript:void(0)')).toBe(false);
  });

  it('returns false for data: URLs', () => {
    expect(isSafeUrl('data:text/html,<h1>hi</h1>')).toBe(false);
  });

  it('returns false for protocol-relative URLs', () => {
    expect(isSafeUrl('//example.com')).toBe(false);
  });

  it('returns false for empty / null / undefined / non-string input', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    // @ts-expect-error - exercising runtime guard
    expect(isSafeUrl(42)).toBe(false);
  });
});
