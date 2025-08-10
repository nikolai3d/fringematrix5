import { describe, it, expect } from 'vitest';
import { formatDeployedAtPacific } from '../src/utils/formatDeployedAtPacific.js';

describe('formatDeployedAtPacific', () => {
  it('formats valid PT string', () => {
    const input = '2024-09-10 14:23:45 PDT';
    expect(formatDeployedAtPacific(input)).toBe('September 10th, 2024, 14:23:45 PDT');
  });

  it('returns input when invalid', () => {
    const invalid = 'not-a-date';
    expect(formatDeployedAtPacific(invalid)).toBe(invalid);
  });
});


