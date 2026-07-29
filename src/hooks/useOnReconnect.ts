import { useEffect, useRef } from 'react';
import { useInternetStatusResolved } from './useInternetStatusContext';
import type { InternetStatusState } from '../core/types';

export interface OnReconnectInfo {
  /** How long we were offline, in ms. `0` if we were never offline. */
  offlineDurationMs: number;
  state: InternetStatusState;
}

export interface UseOnReconnectOptions {
  /** Also fire on mount if already connected. */
  fireOnMount?: boolean;
  /** Wait for probe-verified reachability rather than just `navigator.onLine`. */
  requireReachable?: boolean;
}

/**
 * Runs a callback on the offline → online edge. The usual reason to reach for
 * it: refetching whatever went stale while the connection was down.
 */
export function useOnReconnect(
  callback: (info: OnReconnectInfo) => void,
  options: UseOnReconnectOptions = {}
): void {
  const { fireOnMount = false, requireReachable = true } = options;
  const state = useInternetStatusResolved();

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const wasConnected = useRef<boolean | null>(null);

  const connected = requireReachable
    ? state.status === 'online'
    : state.isOnline;

  // 'unknown' and 'checking' are boot states, not "disconnected". Counting
  // them would make the boot sequence (unknown → online) look like a
  // reconnection and fire on every mount.
  const settled = state.status === 'online' || state.status === 'offline';

  useEffect(() => {
    if (!settled) return;

    const previous = wasConnected.current;
    wasConnected.current = connected;

    if (previous === null) {
      // First settled state is the baseline. Only fire if explicitly asked to.
      if (connected && fireOnMount) {
        callbackRef.current({ offlineDurationMs: 0, state });
      }
      return;
    }

    if (connected && !previous) {
      callbackRef.current({
        offlineDurationMs: state.since > 0 ? Date.now() - state.since : 0,
        state,
      });
    }
    // `state` is in the deps for correctness, but it cannot cause a spurious
    // call: the edge guard above only fires on a false → true transition.
  }, [settled, connected, fireOnMount, state]);
}
