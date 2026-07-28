import { useEffect, useState } from 'react';

/** Subscribe to a CSS media query; returns whether it currently matches. */
export function useVeitMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);

  return matches;
}

/** Alias for {@link useVeitMediaQuery}. */
export const useMediaQuery = useVeitMediaQuery;
