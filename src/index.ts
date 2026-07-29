// hooks
export {
  useInternetStatus,
  useNetworkStoreState,
} from './hooks/useInternetStatus';
export type { UseInternetStatusResult } from './hooks/useInternetStatus';
export { useInternetStatusContext } from './hooks/useInternetStatusContext';
export { useNetworkQuality } from './hooks/useNetworkQuality';
export type { NetworkQuality } from './hooks/useNetworkQuality';
export { useOnReconnect } from './hooks/useOnReconnect';
export type {
  OnReconnectInfo,
  UseOnReconnectOptions,
} from './hooks/useOnReconnect';
export { useOfflineDuration } from './hooks/useOfflineDuration';

// components
export { InternetStatusProvider } from './context/InternetStatusProvider';
export type { InternetStatusProviderProps } from './context/InternetStatusProvider';
export type { InternetStatusContextValue } from './context/InternetStatusContext';
export { InternetStatus } from './components/InternetStatus';
export type { InternetStatusProps } from './components/InternetStatus';
export { Online, Offline } from './components/OnlineOffline';
export type { ConditionalProps } from './components/OnlineOffline';

// advanced
export {
  createNetworkStore,
  getDefaultStore,
  resetDefaultStore,
} from './core/store';
export { readOnLine } from './core/env';
export { setupOnlineManager } from './integrations/tanstack-query';
export type { OnlineManagerLike } from './integrations/tanstack-query';

// types
export type {
  ConnectionInfo,
  EffectiveConnectionType,
  InternetStatusOptions,
  InternetStatusState,
  NetworkStatus,
  NetworkStore,
  ProbeOptions,
  Reachability,
  SlowThresholds,
} from './core/types';
