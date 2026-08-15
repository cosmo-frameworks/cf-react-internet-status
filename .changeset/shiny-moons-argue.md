---
'cf-react-internet-status': major
---

Real internet reachability, SSR safety, and a configurable component.

**Breaking**

- Requires React 18+ (`useSyncExternalStore`). React 17 is no longer supported.
- `useInternetStatus()` now returns a state object instead of a `boolean`.
  Use `.isOnline`, or `.status` for the reachability-aware rollup.
- `<InternetStatus>` now renders ARIA roles and reacts to probe-verified
  reachability. Pass `useReachability={false}` for v1 rendering semantics.
- Package ships dual ESM/CJS behind an `exports` map; deep imports into `dist/`
  and `src/` no longer resolve. `engines.node` is now `>=18`.
- `react-dom` is no longer a peer dependency (it was never imported).

**Fixed**

- Server rendering no longer throws: nothing reads `navigator` at import time
  or during render. The guard checks `navigator.onLine` itself, because Node
  21+ defines `globalThis.navigator` without it.
- Connectivity that changed between the first render and the effect is no
  longer missed — state is re-read when the store starts.
- The context value is memoized, so consumers stop re-rendering whenever the
  provider's parent re-renders.
- The README's first example threw at runtime. It is fixed, and every example
  is now executed as a test.

**Added**

- `isInternetReachable` — verified by an actual request, with configurable
  URL(s), timeout, interval, exponential backoff, anti-flap threshold, pausing
  while the tab is hidden, and re-checks on focus/visibility/bfcache restore.
- `recheck()` for on-demand verification, deduped with any in-flight probe.
- `useNetworkQuality()` over the Network Information API, plus `isSlow`.
- `useOnReconnect()` and `useOfflineDuration()`.
- `<Online>` / `<Offline>` conditional wrappers; `<InternetStatus>` gains
  `className`, `style`, `as`, per-state nodes, a render-prop, `hideWhenOnline`,
  `autoDismissMs`, banner/toast variants and `unstyled`.
- `onOnline` / `onOffline` / `onChange` callbacks on the provider.
- `createNetworkStore()` / `getDefaultStore()` for advanced use, and
  `setupOnlineManager()` to drive TanStack Query from real connectivity.
- The raw hook and every public type are now exported.
