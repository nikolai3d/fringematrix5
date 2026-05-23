import { describe, it, expect } from 'vitest';
import { getInitials } from '../src/utils/author';

describe('getInitials', () => {
  it('returns first two uppercase letters from a camelCase handle', () => {
    expect(getInitials('@SarahProost')).toBe('SP');
  });

  it('handles handles without a leading @', () => {
    expect(getInitials('SarahProost')).toBe('SP');
  });

  it('falls back to first two characters when only one uppercase letter present', () => {
    // '@Zort70' has a single uppercase letter, so per the rule the first two
    // characters of the stripped handle are used: 'Zo' → 'ZO'.
    expect(getInitials('@Zort70')).toBe('ZO');
  });

  it('upper-cases the fallback two characters for all-lowercase handles', () => {
    expect(getInitials('@cheribot')).toBe('CH');
  });

  it('handles single-character handles', () => {
    expect(getInitials('@a')).toBe('A');
  });

  it('returns empty string for an empty handle', () => {
    expect(getInitials('')).toBe('');
  });

  it('returns empty string for just a leading @', () => {
    expect(getInitials('@')).toBe('');
  });

  it('treats handles starting with digits via the fallback rule', () => {
    expect(getInitials('@7thStar')).toBe('7T');
  });

  it('uses the first two uppercase letters when there are more than two', () => {
    expect(getInitials('@ABCdef')).toBe('AB');
  });
});
