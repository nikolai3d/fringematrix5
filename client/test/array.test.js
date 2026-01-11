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

  it('should produce different orderings over multiple runs (probabilistic)', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set();

    // Run shuffle 20 times and collect unique orderings
    for (let i = 0; i < 20; i++) {
      results.add(JSON.stringify(shuffleArray(original)));
    }

    // With 10 elements, probability of getting same order twice is very low
    // We should see multiple different orderings
    expect(results.size).toBeGreaterThan(1);
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
