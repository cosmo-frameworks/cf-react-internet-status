import type {
  EffectiveConnectionType,
  InternetStatusOptions,
  ProbeOptions,
} from './types';

export const DEFAULT_PROBE_OPTIONS: Required<
  Omit<ProbeOptions, 'fetch' | 'probe'>
> = {
  url: '/favicon.ico',
  strategy: 'any',
  method: 'HEAD',
  mode: 'no-cors',
  timeoutMs: 5_000,
  intervalMs: 30_000,
  retryIntervalMs: 2_000,
  maxRetryIntervalMs: 60_000,
  failureThreshold: 2,
  jitter: 0.2,
  cacheBust: true,
};

export const DEFAULT_SLOW_EFFECTIVE_TYPES: EffectiveConnectionType[] = [
  'slow-2g',
  '2g',
];

export const DEFAULT_OPTIONS: Required<
  Omit<InternetStatusOptions, 'probe' | 'slowThresholds'>
> = {
  enableProbe: true,
  pauseWhenHidden: true,
  staleMs: 10_000,
  enableConnectionInfo: true,
};

export const DEFAULT_SLOW_THRESHOLDS = {
  effectiveTypes: DEFAULT_SLOW_EFFECTIVE_TYPES,
  maxDownlink: 0.5,
  maxRtt: 500,
};
