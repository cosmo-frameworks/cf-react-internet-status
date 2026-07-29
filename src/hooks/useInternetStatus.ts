import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createNetworkStore, getDefaultStore } from '../core/store';
import type {
  InternetStatusOptions,
  InternetStatusState,
  NetworkStore,
} from '../core/types';

export interface UseInternetStatusResult extends InternetStatusState {
  /** Force an immediate probe. Dedupes with any in-flight check. */
  recheck: () => Promise<boolean>;
}

/** Subscribes to a store. The reason every consumer stays in sync cheaply. */
export function useNetworkStoreState(store: NetworkStore): InternetStatusState {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
}

/**
 * Provider-free connectivity hook.
 *
 * With no options, every call site shares one module-level store — ten
 * components produce one set of DOM listeners and one probe schedule.
 * With options, the call site gets its own store, destroyed on unmount.
 *
 * Options are read once, on first render; later changes are ignored. Remount
 * with a different `key` if you need them to change.
 */
export function useInternetStatus(
  options?: InternetStatusOptions
): UseInternetStatusResult {
  const storeRef = useRef<NetworkStore | null>(null);
  const ownsStoreRef = useRef(false);

  if (storeRef.current === null) {
    if (options) {
      storeRef.current = createNetworkStore(options);
      ownsStoreRef.current = true;
    } else {
      storeRef.current = getDefaultStore();
    }
  }
  const store = storeRef.current;

  useEffect(
    () => () => {
      if (ownsStoreRef.current) store.destroy();
    },
    [store]
  );

  const state = useNetworkStoreState(store);

  return useMemo(() => ({ ...state, recheck: store.recheck }), [state, store]);
}

export default useInternetStatus;
