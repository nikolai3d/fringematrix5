import { useEffect, useState } from 'react';
import { fetchJSON } from '../utils/fetchJSON';
import type { AuthorDetailResponse } from '../types/api';

const cache = new Map<string, AuthorDetailResponse>();

export function clearAuthorDetailCache(): void {
  cache.clear();
}

export interface AuthorDetailState {
  data: AuthorDetailResponse | null;
  error: string | null;
}

export function useAuthorDetail(handle: string): AuthorDetailState {
  const [data, setData] = useState<AuthorDetailResponse | null>(() => cache.get(handle) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache.has(handle)) {
      setData(cache.get(handle)!);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setData(null);
    setError(null);

    (async () => {
      try {
        const encoded = encodeURIComponent(handle);
        const res = await fetchJSON<AuthorDetailResponse>(`/api/authors/${encoded}`, {
          signal: controller.signal,
        });
        if (cancelled) return;
        cache.set(handle, res);
        setData(res);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to load author detail:', e);
        setData(null);
        setError('Failed to load artist');
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [handle]);

  return { data, error };
}
