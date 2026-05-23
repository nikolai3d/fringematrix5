/**
 * Author-row helpers for the lightbox IMAGE DETAILS sidebar.
 */

/**
 * Derive a short (2-character) initials string from a Twitter-style handle for
 * use as the avatar label in the AUTHOR row.
 *
 * Rules (per fringematrix5-5s8):
 *   1. Strip a leading '@'.
 *   2. If the handle contains 2+ uppercase letters, use the first two
 *      (handy for camelCase handles like '@SarahProost' → 'SP').
 *   3. Otherwise fall back to the first two characters of the handle,
 *      upper-cased.
 *
 * Edge cases:
 *   - Empty input (or just '@') returns '' so the caller can choose a
 *     placeholder.
 *   - Single-character handles return that single character upper-cased.
 *   - Handles starting with a digit (e.g. '@7th') still work — they just
 *     don't match rule 2 and fall through to rule 3.
 */
export function getInitials(handle: string): string {
  const stripped = handle.replace(/^@/, '');
  if (stripped.length === 0) return '';

  const upperLetters = stripped.match(/[A-Z]/g) ?? [];
  if (upperLetters.length >= 2) {
    return (upperLetters[0] + upperLetters[1]).toUpperCase();
  }
  return stripped.slice(0, 2).toUpperCase();
}
