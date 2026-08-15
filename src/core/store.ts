import {
  DEFAULT_OPTIONS,
  DEFAULT_PROBE_OPTIONS,
  DEFAULT_SLOW_THRESHOLDS,
} from './constants';
import { canUseDOM, canUseDocument, isHidden, readOnLine } from './env';
import { probeAll, type ResolvedProbeConfig } from './probe';
import {
  isSlowConnection,
  readConnection,
  subscribeConnection,
} from './connection';
import type {
  InternetStatusOptions,
  InternetStatusState,
  NetworkStatus,
  NetworkStore,
} from './types';

/**
 * `getServerSnapshot` must return a STABLE reference, so this is a frozen
 * module constant. Never spread it, never put `Date.now()` inside it — React
 * calls it on every server render and any new identity is a bug.
 *
 * `isOnline: true` is deliberate: the server cannot know, and baking an
 * offline banner into the markup is the worse failure mode.
 */
const SERVER_SNAPSHOT: InternetStatusState = Object.freeze({
  isOnline: true,
  isInternetReachable: null,
  status: 'unknown',
  isChecking: false,
  since: 0,
  lastCheckedAt: null,
  failureCount: 0,
  connection: null,
  isSlow: false,
});

function shallowEqual(a: InternetStatusState, b: InternetStatusState): boolean {
  return (
    a.isOnline === b.isOnline &&
    a.isInternetReachable === b.isInternetReachable &&
    a.status === b.status &&
    a.isChecking === b.isChecking &&
    a.since === b.since &&
    a.lastCheckedAt === b.lastCheckedAt &&
    a.failureCount === b.failureCount &&
    a.isSlow === b.isSlow &&
    a.connection === b.connection
  );
}

function connectionEqual(
  a: InternetStatusState['connection'],
  b: InternetStatusState['connection']
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.effectiveType === b.effectiveType &&
    a.downlink === b.downlink &&
    a.rtt === b.rtt &&
    a.saveData === b.saveData &&
    a.type === b.type
  );
}

export function createNetworkStore(
  options: InternetStatusOptions = {}
): NetworkStore {
  const opts = {
    ...DEFAULT_OPTIONS,
    ...options,
    probe: { ...DEFAULT_PROBE_OPTIONS, ...options.probe },
    slowThresholds: { ...DEFAULT_SLOW_THRESHOLDS, ...options.slowThresholds },
  };

  const urls = Array.isArray(opts.probe.url)
    ? opts.probe.url
    : [opts.probe.url];

  const listeners = new Set<() => void>();
  let snapshot: InternetStatusState = SERVER_SNAPSHOT;
  let started = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight: Promise<boolean> | null = null;
  let inFlightController: AbortController | null = null;
  let cleanups: Array<() => void> = [];

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const resolveFetch = (): typeof fetch | null => {
    if (opts.probe.fetch) return opts.probe.fetch;
    if (typeof globalThis.fetch !== 'function') return null;
    return globalThis.fetch.bind(globalThis);
  };

  const probeConfig = (fetchImpl: typeof fetch): ResolvedProbeConfig => ({
    method: opts.probe.method,
    mode: opts.probe.mode,
    timeoutMs: opts.probe.timeoutMs,
    cacheBust: opts.probe.cacheBust,
    fetch: fetchImpl,
  });

  function computeStatus(next: InternetStatusState): NetworkStatus {
    if (!next.isOnline) return 'offline';
    if (next.isInternetReachable === false) return 'offline';
    if (next.isInternetReachable === true) return 'online';
    return next.isChecking ? 'checking' : 'unknown';
  }

  /**
   * The single mutation point. Recomputes derived fields, bails out when
   * nothing actually changed (so `getSnapshot` keeps returning the same
   * reference — React 18 throws and loops otherwise), and keeps `since`
   * pinned to real status transitions.
   */
  function update(patch: Partial<InternetStatusState>): void {
    const next: InternetStatusState = { ...snapshot, ...patch };

    if (connectionEqual(next.connection, snapshot.connection)) {
      next.connection = snapshot.connection;
    }
    next.status = computeStatus(next);
    next.isSlow = isSlowConnection(next.connection, opts.slowThresholds);
    next.since = next.status === snapshot.status ? snapshot.since : Date.now();

    if (shallowEqual(next, snapshot)) return;

    snapshot = Object.freeze(next);
    emit();
  }

  function cancelInFlight(): void {
    inFlightController?.abort();
    inFlightController = null;
    inFlight = null;
  }

  function pause(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function nextDelay(): number {
    const base =
      snapshot.failureCount === 0
        ? opts.probe.intervalMs
        : Math.min(
            opts.probe.maxRetryIntervalMs,
            opts.probe.retryIntervalMs * 2 ** (snapshot.failureCount - 1)
          );
    const jitter = opts.probe.jitter;
    if (jitter <= 0) return base;
    return Math.round(base * (1 + (Math.random() * 2 - 1) * jitter));
  }

  function schedule(): void {
    pause();
    if (!started || !opts.enableProbe) return;
    if (!snapshot.isOnline) return; // never probe while the interface is down
    if (opts.pauseWhenHidden && isHidden()) return;
    const delay = nextDelay();
    if (delay <= 0) return; // intervalMs: 0 → event-driven only
    timer = setTimeout(() => void runProbe(), delay);
  }

  function runProbe(): Promise<boolean> {
    if (!opts.enableProbe) return Promise.resolve(snapshot.isOnline);
    if (!snapshot.isOnline) return Promise.resolve(false);
    // Dedupe: concurrent recheck() calls share the in-flight request.
    if (inFlight) return inFlight;

    const customProbe = opts.probe.probe;
    const fetchImpl = customProbe ? null : resolveFetch();
    if (!customProbe && !fetchImpl) {
      // No fetch in this environment. Stay optimistic rather than reporting a
      // false outage the app can do nothing about — but never leave the state
      // stuck on 'checking'.
      update({ isChecking: false, isInternetReachable: true });
      return Promise.resolve(true);
    }

    const controller = new AbortController();
    inFlightController = controller;
    update({ isChecking: true });

    const run = customProbe
      ? customProbe(controller.signal)
      : probeAll(
          urls,
          opts.probe.strategy,
          probeConfig(fetchImpl as typeof fetch),
          controller.signal
        );

    const promise = run
      .then(
        (ok) => ok,
        () => false
      )
      .then((ok) => {
        if (inFlightController !== controller) return ok; // superseded
        const failureCount = ok ? 0 : snapshot.failureCount + 1;
        // Anti-flap: promote to reachable on the first success, but require
        // `failureThreshold` consecutive failures before declaring it dead.
        const reachable = ok
          ? true
          : failureCount >= opts.probe.failureThreshold
            ? false
            : snapshot.isInternetReachable;

        update({
          isInternetReachable: reachable,
          failureCount,
          isChecking: false,
          lastCheckedAt: Date.now(),
        });
        return ok;
      })
      .finally(() => {
        if (inFlightController === controller) {
          inFlightController = null;
          inFlight = null;
          schedule();
        }
      });

    inFlight = promise;
    return promise;
  }

  function syncOnLine(): void {
    const isOnline = readOnLine();
    if (!isOnline) {
      cancelInFlight();
      pause();
      update({
        isOnline: false,
        isInternetReachable: false,
        isChecking: false,
        failureCount: 0,
      });
      return;
    }
    // Coming back up, the previous `false` is stale — we have not re-verified
    // anything yet, so drop to "unknown" and let the probe decide.
    update({
      isOnline: true,
      isInternetReachable: opts.enableProbe ? null : true,
      failureCount: 0,
    });
    void runProbe();
  }

  function onMaybeStale(): void {
    if (!started) return;
    if (opts.pauseWhenHidden && isHidden()) return;

    // Catch online/offline events missed while backgrounded or bfcached.
    const isOnline = readOnLine();
    if (isOnline !== snapshot.isOnline) {
      syncOnLine();
      return;
    }
    if (!isOnline) return;

    const age =
      snapshot.lastCheckedAt === null
        ? Number.POSITIVE_INFINITY
        : Date.now() - snapshot.lastCheckedAt;
    if (age >= opts.staleMs) void runProbe();
    else schedule();
  }

  function start(): void {
    if (started || !canUseDOM()) return;
    started = true;

    // Re-read here rather than trusting a value captured at first render:
    // connectivity may have flipped in between, and nothing replays that.
    const isOnline = readOnLine();
    const connection = opts.enableConnectionInfo ? readConnection() : null;

    // A probe is about to run, so `isChecking` starts true when probing is on
    // — that keeps `status` derived by computeStatus rather than hand-set, so
    // a later unrelated update cannot silently flip it back.
    const isChecking = opts.enableProbe && isOnline;
    const base: InternetStatusState = {
      ...snapshot,
      isOnline,
      // Offline means unreachable, full stop — not "unknown".
      isInternetReachable: isOnline ? (opts.enableProbe ? null : true) : false,
      isChecking,
      status: 'unknown',
      since: Date.now(),
      lastCheckedAt: null,
      failureCount: 0,
      connection,
      isSlow: isSlowConnection(connection, opts.slowThresholds),
    };
    base.status = computeStatus(base);
    snapshot = Object.freeze(base);

    const onWindow = (type: string, handler: () => void) => {
      window.addEventListener(type, handler);
      cleanups.push(() => window.removeEventListener(type, handler));
    };

    onWindow('online', syncOnLine);
    onWindow('offline', syncOnLine);
    onWindow('focus', onMaybeStale);
    onWindow('pageshow', onMaybeStale); // bfcache restore

    if (canUseDocument()) {
      const onVisibility = () => {
        if (isHidden()) pause();
        else onMaybeStale();
      };
      document.addEventListener('visibilitychange', onVisibility);
      cleanups.push(() =>
        document.removeEventListener('visibilitychange', onVisibility)
      );
    }

    if (opts.enableConnectionInfo) {
      cleanups.push(
        subscribeConnection(() => update({ connection: readConnection() }))
      );
    }

    emit(); // publish the corrected initial snapshot
    if (opts.enableProbe && isOnline) void runProbe();
  }

  function stop(): void {
    started = false;
    pause();
    cancelInFlight();
    for (const cleanup of cleanups) cleanup();
    cleanups = [];
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      // Refcounted: listeners and timers belong to the store, not to a
      // useEffect. This makes StrictMode double-mounting, multiple providers
      // and unmount cleanup all correct for free.
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    recheck: () => runProbe(),
    destroy: () => {
      listeners.clear();
      stop();
    },
  };
}

let defaultStore: NetworkStore | null = null;

/** Lazy, so importing this module never touches `navigator`. */
export function getDefaultStore(): NetworkStore {
  defaultStore ??= createNetworkStore();
  return defaultStore;
}

/** Test-only: drops the shared default store. */
export function resetDefaultStore(): void {
  defaultStore?.destroy();
  defaultStore = null;
}

export { SERVER_SNAPSHOT };
