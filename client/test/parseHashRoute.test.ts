import { describe, it, expect } from 'vitest';
import { parseHashRoute } from '../src/utils/parseHashRoute';

describe('parseHashRoute', () => {
  it('returns gallery with null campaignId for an empty hash', () => {
    expect(parseHashRoute('')).toEqual({ type: 'gallery', campaignId: null });
    expect(parseHashRoute('#')).toEqual({ type: 'gallery', campaignId: null });
  });

  it('returns authors-index for "#authors"', () => {
    expect(parseHashRoute('#authors')).toEqual({ type: 'authors-index' });
    expect(parseHashRoute('authors')).toEqual({ type: 'authors-index' });
  });

  it('returns authors-index when the handle segment is empty (trailing slash)', () => {
    expect(parseHashRoute('#authors/')).toEqual({ type: 'authors-index' });
  });

  it('returns author-detail with a URL-decoded handle', () => {
    expect(parseHashRoute('#authors/%40Zort70')).toEqual({
      type: 'author-detail',
      handle: '@Zort70',
    });
  });

  it('treats any other hash value as a campaign id', () => {
    expect(parseHashRoute('#crosstheline')).toEqual({
      type: 'gallery',
      campaignId: 'crosstheline',
    });
  });

  it('gracefully handles malformed URI escape sequences', () => {
    // '%E0%A4' is incomplete and would throw in decodeURIComponent
    expect(parseHashRoute('#authors/%E0%A4')).toEqual({
      type: 'author-detail',
      handle: '%E0%A4',
    });
  });
});
