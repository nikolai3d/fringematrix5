import { describe, it, expect } from 'vitest';
import { getInitials, getInitialsFromName } from '../src/utils/author';

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

describe('getInitialsFromName', () => {
  it('returns first letter of the first two words for a two-word name', () => {
    expect(getInitialsFromName('Sarah Proost')).toBe('SP');
  });

  it('uses only the first two words when more than two are present', () => {
    expect(getInitialsFromName('Mary Anne Smith')).toBe('MA');
  });

  it('falls back to first two characters for a single-word name', () => {
    expect(getInitialsFromName('Cheribot')).toBe('CH');
  });

  it('upper-cases the result for lowercase input', () => {
    expect(getInitialsFromName('sarah proost')).toBe('SP');
  });

  it('returns empty string for an empty name', () => {
    expect(getInitialsFromName('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(getInitialsFromName('   ')).toBe('');
  });

  it('handles leading and trailing whitespace', () => {
    expect(getInitialsFromName('  Sarah Proost  ')).toBe('SP');
  });

  it('handles a single character name', () => {
    expect(getInitialsFromName('a')).toBe('A');
  });

  it('does not strip a leading @ (display names are not handles)', () => {
    // Unlike `getInitials`, '@' is treated as a literal character of the
    // first (and only) word, so the first two chars are '@F'.
    expect(getInitialsFromName('@Foo')).toBe('@F');
  });

  it('collapses multiple whitespace characters between words', () => {
    expect(getInitialsFromName('Sarah   Proost')).toBe('SP');
  });
});
