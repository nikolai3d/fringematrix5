/**
 * Helpers for building direct Vercel Blob CDN URLs from registry blob paths.
 *
 * Images are uploaded with `addRandomSuffix: false` (see
 * scripts/lib/image-db.mjs), so a blob's public URL is fully determined by
 * the store's public origin plus its pathname. Building the URL locally lets
 * endpoints that only know a blob path (e.g. /api/authors/:handle, which reads
 * the image registry rather than listing Blob) hand the client a direct CDN
 * URL instead of a `/avatars/<path>` redirect. That redirect costs a
 * serverless invocation plus a Blob `list()` API call PER IMAGE and bypasses
 * the `/_vercel/image` thumbnail optimizer, which only whitelists Blob hosts.
 */

const BLOB_PUBLIC_HOST_SUFFIX = '.public.blob.vercel-storage.com';

/**
 * Derives the public Blob store origin from a read-write token.
 *
 * Tokens have the shape `vercel_blob_rw_<storeId>_<secret>`, and the store's
 * public host is `<storeId lowercased>.public.blob.vercel-storage.com`
 * (verified against every blob in the production store). Returns null for a
 * missing or unrecognized token so callers can fall back to `/avatars/...`.
 */
export function blobPublicOriginFromToken(token: string | undefined | null): string | null {
  if (typeof token !== 'string') return null;
  const match = /^vercel_blob_rw_([A-Za-z0-9]+)_[^_\s]+$/.exec(token.trim());
  if (!match) return null;
  return `https://${match[1]!.toLowerCase()}${BLOB_PUBLIC_HOST_SUFFIX}`;
}

/**
 * Percent-encodes each pathname segment the way Vercel Blob does in the URLs
 * it returns: RFC 3986 strict, so `!'()*` are encoded too (encodeURIComponent
 * alone leaves them as-is, which would not match e.g. `%28supernova%29`).
 */
export function encodeBlobPathname(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');
}

/**
 * Returns the URL the client should load for `blobPath`: the direct CDN URL
 * when the store origin is known, otherwise the legacy `/<blobPath>` path
 * served by the /avatars/* redirect route.
 */
export function publicBlobUrl(origin: string | null, blobPath: string): string {
  if (!origin) return `/${blobPath}`;
  return `${origin}/${encodeBlobPathname(blobPath)}`;
}

/**
 * Validates a `/_vercel/image?url=` target the same way vercel.json's
 * `images.remotePatterns` does: https, a `*.public.blob.vercel-storage.com`
 * host, and an `/avatars/` path. When `expectedOrigin` (this deployment's own
 * store, derived from the token) is known, the target must also be on exactly
 * that origin, so the shim can't bounce to someone else's Blob store. Returns
 * the normalized URL string, or null when the target must be rejected
 * (prevents an open redirect).
 */
export function validateOptimizerTarget(raw: unknown, expectedOrigin?: string | null): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password || url.port) return null;
  if (!/^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/.test(url.hostname)) return null;
  if (!url.pathname.startsWith('/avatars/')) return null;
  if (expectedOrigin && url.origin !== expectedOrigin) return null;
  return url.toString();
}
