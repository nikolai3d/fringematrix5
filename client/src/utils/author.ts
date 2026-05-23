/**
 * Author-row helpers for the lightbox IMAGE DETAILS sidebar and the
 * /authors index + detail pages.
 *
 * Two distinct flavors of "initials" exist because the two call sites have
 * different inputs:
 *   - `getInitials(handle)` — Twitter-style handle, possibly camelCase.
 *   - `getInitialsFromName(name)` — human-readable display name with spaces.
 */

/**
 * Derive a short (2-character) initials string from a Twitter-style handle for
 * use as the avatar label in the AUTHOR row of the lightbox sidebar.
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
 *
 * For display names with whitespace (e.g. "Sarah Proost"), prefer
 * `getInitialsFromName` — this function does not split on whitespace.
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

/**
 * Derive a short (2-character) initials string from a human-readable display
 * name for use as the avatar label on the authors index + detail pages.
 *
 * Rules:
 *   1. Trim leading/trailing whitespace.
 *   2. Split on whitespace. If there are 2+ words, take the first letter of
 *      the first two words (e.g. "Sarah Proost" → "SP").
 *   3. Otherwise (single word like "Cheribot") fall back to the first two
 *      characters of the name.
 *   4. Result is upper-cased.
 *
 * Edge cases:
 *   - Empty input (or whitespace-only) returns '' so the caller can choose a
 *     placeholder.
 *   - Single-character names return that single character upper-cased.
 *   - Unlike `getInitials`, no leading '@' is stripped — display names are
 *     not handles.
 */
export function getInitialsFromName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';

  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
