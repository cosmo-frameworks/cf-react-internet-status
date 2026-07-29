import { createContext } from 'react';
import type { NetworkStore } from '../core/types';

export interface InternetStatusContextValue {
  store: NetworkStore;
}

/**
 * Carries the *store*, not a snapshot. Consumers subscribe to it themselves,
 * so exactly one store is ever subscribed to per component — a provider does
 * not cause the shared default store to spin up a second probe schedule.
 *
 * Kept in its own module so components can read the context without importing
 * the provider (and creating an import cycle).
 */
export const InternetStatusContext = createContext<
  InternetStatusContextValue | undefined
>(undefined);
