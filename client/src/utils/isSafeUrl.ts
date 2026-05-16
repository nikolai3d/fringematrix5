/**
 * Returns true only if the given URL begins with http:// or https://.
 *
 * This guards against javascript: URLs (and other dangerous schemes) being
 * injected into href attributes from data sources such as campaigns.yaml.
 * All falsy values (undefined, null, empty string) return false so callers
 * can safely use this as a gate before rendering an <a> element.
 */
export function isSafeUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\//i.test(url);
}
