import { describe, it, expect } from 'vitest';
import { shuffleArray } from '../src/utils/array';

describe('shuffleArray', () => {
  it('should return a new array (not mutate original)', () => {
    const original = [1, 2, 3, 4, 5];
    const originalCopy = [...original];
    const shuffled = shuffleArray(original);

    // Original should be unchanged
    expect(original).toEqual(originalCopy);
    // Shuffled should be a different array instance
    expect(shuffled).not.toBe(original);
  });

  it('should contain all original elements', () => {
    const original = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = shuffleArray(original);

    expect(shuffled).toHaveLength(original.length);
    original.forEach(item => {
      expect(shuffled).toContain(item);
    });
  });

  it('should handle empty array', () => {
    const result = shuffleArray([]);
    expect(result).toEqual([]);
  });

  it('should handle single element array', () => {
    const result = shuffleArray(['only']);
    expect(result).toEqual(['only']);
  });

  it('should produce deterministic output with seeded rng', () => {
    // Mulberry32 seeded PRNG for deterministic testing
    function createSeededRng(seed) {
      let state = seed;
      return () => {
        state |= 0;
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rng = createSeededRng(12345);
    const shuffled = shuffleArray(original, rng);

    // With seed 12345, Fisher-Yates produces this exact permutation
    expect(shuffled).toEqual([7, 5, 9, 1, 2, 8, 6, 4, 3, 10]);

    // Verify same seed produces same result
    const rng2 = createSeededRng(12345);
    expect(shuffleArray(original, rng2)).toEqual([7, 5, 9, 1, 2, 8, 6, 4, 3, 10]);

    // Different seed produces different result
    const rng3 = createSeededRng(99999);
    expect(shuffleArray(original, rng3)).not.toEqual([7, 5, 9, 1, 2, 8, 6, 4, 3, 10]);
  });

  it('should work with different types', () => {
    const numbers = shuffleArray([1, 2, 3]);
    expect(numbers).toHaveLength(3);
    expect(numbers).toContain(1);
    expect(numbers).toContain(2);
    expect(numbers).toContain(3);

    const objects = shuffleArray([{ a: 1 }, { b: 2 }]);
    expect(objects).toHaveLength(2);
  });

  it('should preserve element references for objects', () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    const original = [obj1, obj2];
    const shuffled = shuffleArray(original);

    // Same object references should be in the shuffled array
    expect(shuffled).toContain(obj1);
    expect(shuffled).toContain(obj2);
  });
});
