/** Probe-verified reachability. `null` means unknown / first check pending. */
export type Reachability = boolean | null;

export type NetworkStatus = 'online' | 'offline' | 'checking' | 'unknown';

export type EffectiveConnectionType = 'slow-2g' | '2g' | '3g' | '4g';

export interface ConnectionInfo {
  effectiveType: EffectiveConnectionType | null;
  /** Estimated downlink bandwidth, in Mbps. */
  downlink: number | null;
  /** Estimated effective round-trip time, in ms. */
  rtt: number | null;
  /** The user asked for reduced data usage. */
  saveData: boolean;
  /** 'wifi' | 'cellular' | 'ethernet' | ... — rarely populated in practice. */
  type: string | null;
}

export interface SlowThresholds {
  effectiveTypes?: EffectiveConnectionType[];
  /** Below this downlink (Mbps) the connection counts as slow. */
  maxDownlink?: number;
  /** Above this RTT (ms) the connection counts as slow. */
  maxRtt?: number;
}

export interface InternetStatusState {
  /** `navigator.onLine` — the network *interface* is up. Cheap, unreliable. */
  isOnline: boolean;
  /** Probe-verified. `null` while unknown or the first check is pending. */
  isInternetReachable: Reachability;
  /** Derived rollup, convenient for rendering. */
  status: NetworkStatus;
  /** True while a probe is in flight. */
  isChecking: boolean;
  /** Epoch ms of the last `status` change. */
  since: number;
  /** Epoch ms of the last completed probe, or `null`. */
  lastCheckedAt: number | null;
  /** Consecutive probe failures. Drives the backoff. */
  failureCount: number;
  /** Network Information API data, or `null` where unsupported. */
  connection: ConnectionInfo | null;
  /** Heuristic over `connection`. */
  isSlow: boolean;
}

export interface ProbeOptions {
  /**
   * URL(s) to probe. Relative URLs resolve against `location.origin`.
   * Defaults to `/favicon.ico` — same-origin, so no CORS setup is needed and
   * it answers the question most apps actually care about ("can I reach my
   * own server?") without making an unannounced third-party request.
   */
  url?: string | string[];
  /** `'any'`: reachable if any URL succeeds. `'all'`: every URL must succeed. */
  strategy?: 'any' | 'all';
  method?: 'HEAD' | 'GET';
  mode?: RequestMode;
  timeoutMs?: number;
  /** Poll interval while reachable. `0` disables polling (event-driven only). */
  intervalMs?: number;
  /** Base retry delay after a failure. Doubles per consecutive failure. */
  retryIntervalMs?: number;
  maxRetryIntervalMs?: number;
  /** Consecutive failures before flipping to unreachable. Anti-flap. */
  failureThreshold?: number;
  /** Fraction of random jitter (±) applied to scheduled delays. `0` in tests. */
  jitter?: number;
  /** Append a cache-busting query parameter. */
  cacheBust?: boolean;
  /** Injectable for tests or custom auth. Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Full escape hatch: replace the probe logic entirely. */
  probe?: (signal: AbortSignal) => Promise<boolean>;
}

export interface InternetStatusOptions {
  /** `false` disables probing — `isInternetReachable` then mirrors `isOnline`. */
  enableProbe?: boolean;
  probe?: ProbeOptions;
  /** Pause probing while `document.hidden`. */
  pauseWhenHidden?: boolean;
  /** On focus/visible, re-probe if the last check is older than this. */
  staleMs?: number;
  /** Read `navigator.connection`. */
  enableConnectionInfo?: boolean;
  slowThresholds?: SlowThresholds;
}

export interface NetworkStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): InternetStatusState;
  getServerSnapshot(): InternetStatusState;
  /** Force an immediate probe. Dedupes with any in-flight check. */
  recheck(): Promise<boolean>;
  destroy(): void;
}
