import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createNetworkStore } from '../core/store';
import { useNetworkStoreState } from '../hooks/useInternetStatus';
import { InternetStatusContext } from './InternetStatusContext';
import type {
  InternetStatusOptions,
  InternetStatusState,
  NetworkStore,
} from '../core/types';

export interface InternetStatusProviderProps extends InternetStatusOptions {
  children?: ReactNode;
  /** Inject a pre-built store — useful for tests or multiple React roots. */
  store?: NetworkStore;
  onOnline?: (state: InternetStatusState) => void;
  onOffline?: (state: InternetStatusState) => void;
  onChange?: (
    state: InternetStatusState,
    previous: InternetStatusState
  ) => void;
}

export function InternetStatusProvider({
  children,
  store: externalStore,
  onOnline,
  onOffline,
  onChange,
  ...options
}: InternetStatusProviderProps) {
  // Created once. Option changes after mount are ignored by design: the store
  // owns timers and listeners, so rebuilding it mid-flight would drop in-flight
  // probes and re-register listeners on every render.
  const [ownStore] = useState<NetworkStore | null>(() =>
    externalStore ? null : createNetworkStore(options)
  );
  const store = externalStore ?? (ownStore as NetworkStore);

  useEffect(() => {
    if (!ownStore) return;
    return () => ownStore.destroy();
  }, [ownStore]);

  const state = useNetworkStoreState(store);

  // Ref-latched: passing inline arrows must not re-run the effect below.
  const callbacks = useRef({ onOnline, onOffline, onChange });
  callbacks.current = { onOnline, onOffline, onChange };

  const previous = useRef<InternetStatusState | null>(null);

  useEffect(() => {
    // 'unknown' and 'checking' are boot states: we have not established
    // anything yet. Treating them as a baseline would make the boot sequence
    // (unknown → online) look like a reconnection and fire onOnline on every
    // single mount.
    if (state.status !== 'online' && state.status !== 'offline') return;

    const prev = previous.current;
    previous.current = state;

    // The first settled state is the baseline — no synthetic mount events.
    if (prev === null || prev.status === state.status) return;

    callbacks.current.onChange?.(state, prev);
    if (state.status === 'online') callbacks.current.onOnline?.(state);
    if (state.status === 'offline') callbacks.current.onOffline?.(state);
  }, [state]);

  const value = useMemo(() => ({ store }), [store]);

  return (
    <InternetStatusContext.Provider value={value}>
      {children}
    </InternetStatusContext.Provider>
  );
}
