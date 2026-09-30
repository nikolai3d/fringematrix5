import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatTimePacific } from '../../src/utils/formatTimePacific';

/**
 * Covers the toLocaleString output-shape branches of formatTimePacific.
 * Different ICU / Node versions format dates as either
 *   "August 17, 2025 at 6:44:27 PM PDT"  or
 *   "August 17, 2025, 6:44:27 PM PDT"
 * so both shapes plus the unknown-shape fallback and the error path are
 * exercised deterministically by stubbing Date.prototype.toLocaleString.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const ISO = '2025-08-18T01:44:27.000Z';

describe('formatTimePacific — locale output shapes', () => {
  it('handles the "at" separator shape', () => {
    vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('August 17, 2025 at 6:44:27 PM PDT');
    expect(formatTimePacific(ISO)).toBe('August 17th, 2025, 6:44:27 PM PDT');
  });

  it('handles the comma separator shape', () => {
    vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('March 3, 2024, 01:02:03 AM PST');
    expect(formatTimePacific(ISO)).toBe('March 3rd, 2024, 01:02:03 AM PST');
  });

  it('returns the raw formatted string for unrecognised shapes', () => {
    vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('17/08/2025 18:44:27');
    expect(formatTimePacific(ISO)).toBe('17/08/2025 18:44:27');
  });

  it('returns the input and warns when formatting throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(() => {
      throw new RangeError('bad tz');
    });
    expect(formatTimePacific(ISO)).toBe(ISO);
    expect(warn).toHaveBeenCalledWith('Error formatting timestamp:', expect.any(RangeError));
  });

  it('requests Pacific time zone formatting', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('x');
    formatTimePacific(ISO);
    expect(spy).toHaveBeenCalledWith('en-US', expect.objectContaining({ timeZone: 'America/Los_Angeles' }));
  });

  it('formats PDT legacy strings and ordinalizes 1st/2nd/11th', () => {
    expect(formatTimePacific('2024-07-01 09:00:00 PDT')).toBe('July 1st, 2024, 09:00:00 PDT');
    expect(formatTimePacific('2024-07-02 09:00:00 PDT')).toBe('July 2nd, 2024, 09:00:00 PDT');
    expect(formatTimePacific('2024-07-11 09:00:00 PDT')).toBe('July 11th, 2024, 09:00:00 PDT');
  });

  it('returns non-string input unchanged', () => {
    expect(formatTimePacific(123 as unknown as string)).toBe(123);
  });
});
