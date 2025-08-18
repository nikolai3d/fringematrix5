import { describe, it, expect } from 'vitest';
import { formatTimePacific } from '../src/utils/formatTimePacific.js';

describe('formatTimePacific', () => {
  it('formats ISO 8601 dates correctly', () => {
    const iso = '2025-08-18T01:44:27.432Z';
    const result = formatTimePacific(iso);
    expect(result).toMatch(/August \d+\w{2}, 2025, \d{1,2}:\d{2}:\d{2} (AM|PM) P[SD]T/); // August 17th, 2025 (Pacific time)
  });

  it('handles legacy Pacific format', () => {
    const legacy = '2024-01-15 14:30:45 PST';
    const result = formatTimePacific(legacy);
    expect(result).toBe('January 15th, 2024, 14:30:45 PST');
  });

  it('handles N/A values', () => {
    expect(formatTimePacific('N/A')).toBe('N/A');
    expect(formatTimePacific(null)).toBe(null);
    expect(formatTimePacific('')).toBe('');
  });

  it('handles invalid dates gracefully', () => {
    const invalid = 'not-a-date';
    expect(formatTimePacific(invalid)).toBe(invalid);
  });
});
