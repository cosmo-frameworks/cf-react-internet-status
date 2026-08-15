import { useEffect, useState } from 'react';
import { useInternetStatusResolved } from './useInternetStatusContext';

/**
 * Live counter of how long we have been offline, in ms. Returns `0` while
 * connected.
 *
 * Deliberately opt-in and separate from the status snapshot: a ticking value
 * in the store would re-render every consumer once per second, whether or not
 * they care about the duration.
 */
export function useOfflineDuration(intervalMs = 1_000): number {
  const { status, since } = useInternetStatusResolved();
  const isOffline = status === 'offline';

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isOffline || since <= 0) {
      setElapsed(0);
      return;
    }

    setElapsed(Date.now() - since);
    const id = setInterval(() => setElapsed(Date.now() - since), intervalMs);
    return () => clearInterval(id);
  }, [isOffline, since, intervalMs]);

  return elapsed;
}
