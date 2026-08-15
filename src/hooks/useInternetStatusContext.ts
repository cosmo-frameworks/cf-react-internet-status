import { useContext, useMemo } from 'react';
import { InternetStatusContext } from '../context/InternetStatusContext';
import { getDefaultStore } from '../core/store';
import { useNetworkStoreState } from './useInternetStatus';
import type { UseInternetStatusResult } from './useInternetStatus';

/**
 * Reads the status from the nearest `InternetStatusProvider`.
 * Throws if there isn't one above the calling component.
 */
export function useInternetStatusContext(): UseInternetStatusResult {
  const context = useContext(InternetStatusContext);
  if (!context) {
    throw new Error(
      'useInternetStatusContext must be used within an InternetStatusProvider'
    );
  }
  const { store } = context;
  const state = useNetworkStoreState(store);
  return useMemo(() => ({ ...state, recheck: store.recheck }), [state, store]);
}

/**
 * Internal: uses the provider's store when present, the shared default store
 * when not. Exactly one subscription either way, so the shipped components
 * work with or without a provider and never double-probe.
 */
export function useInternetStatusResolved(): UseInternetStatusResult {
  const context = useContext(InternetStatusContext);
  // Constructing the default store is inert — it registers no listeners and
  // starts no timers until something actually subscribes.
  const store = context?.store ?? getDefaultStore();
  const state = useNetworkStoreState(store);
  return useMemo(() => ({ ...state, recheck: store.recheck }), [state, store]);
}
