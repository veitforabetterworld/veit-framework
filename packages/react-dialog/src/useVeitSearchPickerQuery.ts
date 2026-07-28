import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue.js';

export const VEIT_SEARCH_DEBOUNCE_MS = 280;

export type UseVeitSearchPickerQueryArgs<T> = {
  enabled?: boolean;
  query: string;
  minQuery?: number;
  debounceMs?: number;
  /** When set, empty trimmed query uses this debounce instead of `debounceMs`. */
  debounceMsWhenEmpty?: number;
  fetchItems: (debouncedQuery: string) => Promise<T[]>;
  fetchDeps?: readonly unknown[];
  resetKey?: unknown;
};

export type UseVeitSearchPickerQueryResult<T> = {
  items: T[];
  loading: boolean;
  error: string | null;
  hasFetched: boolean;
  debouncedQuery: string;
  queryReady: boolean;
};

export function useVeitSearchPickerQuery<T>({
  enabled = true,
  query,
  minQuery = 0,
  debounceMs = VEIT_SEARCH_DEBOUNCE_MS,
  debounceMsWhenEmpty,
  fetchItems,
  fetchDeps = [],
  resetKey,
}: UseVeitSearchPickerQueryArgs<T>): UseVeitSearchPickerQueryResult<T> {
  const trimmedQuery = query.trim();
  const effectiveDebounce =
    debounceMsWhenEmpty != null && trimmedQuery.length === 0 ? debounceMsWhenEmpty : debounceMs;
  const debouncedQuery = useDebouncedValue(trimmedQuery, effectiveDebounce);
  const queryReady = debouncedQuery.length >= minQuery;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    setItems([]);
    setError(null);
    setLoading(false);
    setHasFetched(false);
  }, [resetKey]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setHasFetched(false);
      setError(null);
      return;
    }
    if (!queryReady) {
      setItems([]);
      setLoading(false);
      setHasFetched(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchItems(debouncedQuery)
      .then((list) => {
        if (!cancelled) {
          setItems(list);
          setHasFetched(true);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setItems([]);
          setHasFetched(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchDeps is intentional
  }, [enabled, queryReady, debouncedQuery, fetchItems, ...fetchDeps]);

  return useMemo(
    () => ({ items, loading, error, hasFetched, debouncedQuery, queryReady }),
    [items, loading, error, hasFetched, debouncedQuery, queryReady],
  );
}
