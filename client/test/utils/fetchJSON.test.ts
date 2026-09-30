import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJSON } from '../../src/utils/fetchJSON';

function mockResponse(opts: {
  ok?: boolean;
  status?: number;
  contentType?: string | null;
  text?: string | (() => Promise<string>);
  json?: unknown;
}) {
  const headers = new Headers();
  if (opts.contentType) headers.set('content-type', opts.contentType);
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers,
    text: typeof opts.text === 'function' ? opts.text : async () => opts.text ?? '',
    json: async () => opts.json,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchJSON', () => {
  it('returns parsed JSON and sends Accept header + signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ contentType: 'application/json; charset=utf-8', json: { a: 1 } }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(fetchJSON('/api/x', { signal: controller.signal })).resolves.toEqual({ a: 1 });

    expect(fetchMock).toHaveBeenCalledWith('/api/x', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  });

  it('passes an undefined signal when no options are given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ contentType: 'application/json', json: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchJSON('/api/y');
    expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();
  });

  it('throws with status and a truncated body for non-ok responses', async () => {
    const longBody = 'x'.repeat(500);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ ok: false, status: 503, text: longBody })));
    const err = await fetchJSON('/api/down').catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('Failed to fetch /api/down (status 503).');
    // Body is sliced to 200 chars
    expect((err as Error).message).toContain('x'.repeat(200));
    expect((err as Error).message).not.toContain('x'.repeat(201));
  });

  it('still throws a status error when reading the error body fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({ ok: false, status: 404, text: () => Promise.reject(new Error('boom')) }),
      ),
    );
    await expect(fetchJSON('/api/missing')).rejects.toThrow('Failed to fetch /api/missing (status 404).');
  });

  it('throws when the content type is not JSON, including the start of the body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({ contentType: 'text/html', text: '<!doctype html><html>' })),
    );
    await expect(fetchJSON('/api/html')).rejects.toThrow(
      "Expected JSON from /api/html but got 'text/html'. Body starts: <!doctype html><html>",
    );
  });

  it('treats a missing content-type header as non-JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse({ contentType: null, text: 'plain' })));
    await expect(fetchJSON('/api/none')).rejects.toThrow("but got ''. Body starts: plain");
  });

  it('handles a failing body read on a non-JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({ contentType: 'text/plain', text: () => Promise.reject(new Error('nope')) }),
      ),
    );
    await expect(fetchJSON('/api/t')).rejects.toThrow("Expected JSON from /api/t but got 'text/plain'. Body starts: ");
  });

  it('propagates fetch rejections (e.g. abort)', async () => {
    const abortErr = new DOMException('aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));
    await expect(fetchJSON('/api/z')).rejects.toBe(abortErr);
  });
});
