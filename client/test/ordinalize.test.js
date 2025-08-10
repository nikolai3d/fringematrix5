import { describe, it, expect } from 'vitest';
import { ordinalize } from '../src/utils/ordinalize.js';

describe('ordinalize', () => {
  it('handles standard endings', () => {
    expect(ordinalize(1)).toBe('1st');
    expect(ordinalize(2)).toBe('2nd');
    expect(ordinalize(3)).toBe('3rd');
    expect(ordinalize(4)).toBe('4th');
  });

  it('handles teens 11-13 as th', () => {
    expect(ordinalize(11)).toBe('11th');
    expect(ordinalize(12)).toBe('12th');
    expect(ordinalize(13)).toBe('13th');
  });

  it('handles larger numbers', () => {
    expect(ordinalize(21)).toBe('21st');
    expect(ordinalize(22)).toBe('22nd');
    expect(ordinalize(23)).toBe('23rd');
    expect(ordinalize(111)).toBe('111th');
  });
});


