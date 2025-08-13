// Escapes a string for safe use inside a CSS attribute selector, e.g. img[src="..."]
// Uses CSS.escape when available (browsers), and falls back to a regex replacement in other environments.
export function escapeForAttributeSelector(value) {
  const stringValue = String(value);
  try {
    if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') {
      return CSS.escape(stringValue);
    }
  } catch (_) {
    // ignore and use fallback
  }
  // Escape all non-alphanumeric characters (including quotes, whitespace, backslash, etc.)
  return stringValue.replace(/([^\w])/g, '\\$1');
}


