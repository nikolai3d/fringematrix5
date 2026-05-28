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

interface FetchState {
  handle: string;
  data: AuthorDetailResponse | null;
  error: string | null;
}

export function useAuthorDetail(handle: string): AuthorDetailState {
  const [state, setState] = useState<FetchState>({ handle, data: cache.get(handle) ?? null, error: null });

  useEffect(() => {
    if (cache.has(handle)) {
      setState({ handle, data: cache.get(handle)!, error: null });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setState({ handle, data: null, error: null });

    (async () => {
      try {
        const encoded = encodeURIComponent(handle);
        const res = await fetchJSON<AuthorDetailResponse>(`/api/authors/${encoded}`, {
          signal: controller.signal,
        });
        if (cancelled) return;
        cache.set(handle, res);
        setState({ handle, data: res, error: null });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error('Failed to load author detail:', e);
        setState({ handle, data: null, error: 'Failed to load artist' });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [handle]);

  // Read cache synchronously during render so handle changes to a cached value
  // take effect in the same render commit, not after an effect flush.
  const cached = cache.get(handle) ?? null;
  if (cached) return { data: cached, error: null };

  // When the async state is for a different handle (handle just changed),
  // return the "loading" state — no stale data or stale error shown.
  if (state.handle !== handle) return { data: null, error: null };

  return { data: state.data, error: state.error };
}
