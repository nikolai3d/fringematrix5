import { describe, it, expect } from 'vitest';
import { parseEpisodeId } from '../src/utils/parseEpisodeId';

describe('parseEpisodeId', () => {
  it('parses zero-padded episode id', () => {
    const result = parseEpisodeId('4.08');
    expect(result).toEqual({ season: 4, episode: 8, label: 'S4 · E08 (4.08)' });
  });

  it('parses single-digit episode and zero-pads the label', () => {
    const result = parseEpisodeId('4.8');
    expect(result).toEqual({ season: 4, episode: 8, label: 'S4 · E08 (4.8)' });
  });

  it('parses two-digit episode', () => {
    const result = parseEpisodeId('5.13');
    expect(result).toEqual({ season: 5, episode: 13, label: 'S5 · E13 (5.13)' });
  });

  it('returns null for empty / null / undefined input', () => {
    expect(parseEpisodeId('')).toBeNull();
    expect(parseEpisodeId(null)).toBeNull();
    expect(parseEpisodeId(undefined)).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseEpisodeId('garbage')).toBeNull();
    expect(parseEpisodeId('4')).toBeNull();
    expect(parseEpisodeId('4.')).toBeNull();
    expect(parseEpisodeId('.08')).toBeNull();
    expect(parseEpisodeId('4.08.1')).toBeNull();
    expect(parseEpisodeId('S4.E08')).toBeNull();
  });

  it('does not coerce non-string input', () => {
    // @ts-expect-error - exercising runtime guard
    expect(parseEpisodeId(4.08)).toBeNull();
    // @ts-expect-error
    expect(parseEpisodeId({})).toBeNull();
  });
});
