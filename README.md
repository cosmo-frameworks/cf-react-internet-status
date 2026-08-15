# cf-react-internet-status

SSR-safe React hooks and components for online/offline detection — with real
internet reachability probing, not just `navigator.onLine`.

> `navigator.onLine` tells you a cable is plugged in.
> This tells you whether the internet actually answers.

Zero dependencies. ~3.6 KB minified + brotlied. React 18 & 19.

## Why

`navigator.onLine` reports whether a **network interface** is up — not whether
you can reach anything. It returns `true` in every one of these cases:

| Situation                     | `navigator.onLine` | Reality     |
| ----------------------------- | ------------------ | ----------- |
| Connected to a captive portal | `true`             | No internet |
| Router up, WAN link down      | `true`             | No internet |
| DNS resolver broken           | `true`             | No internet |
| VPN dropped mid-session       | `true`             | No internet |
| Airplane mode                 | `false`            | No internet |

This package keeps the cheap signal (`isOnline`) and adds a verified one
(`isInternetReachable`) backed by an actual request.

## Installation

```bash
npm install cf-react-internet-status
# pnpm add cf-react-internet-status
# yarn add cf-react-internet-status
```

Peer dependency: `react@^18 || ^19`.

## Quick start

The smallest correct thing — no provider needed:

```tsx
import { useInternetStatus } from 'cf-react-internet-status';

function ConnectionBanner() {
  const { status, isOnline, isInternetReachable } = useInternetStatus();
  return <p>{status === 'offline' ? 'No connection' : 'Connected'}</p>;
}
```

Every call site with no options shares **one** store, so ten components mean
one set of listeners and one probe schedule.

### With a provider

Use the provider when you want to configure probing once, or attach callbacks:

```tsx
import {
  InternetStatusProvider,
  useInternetStatusContext,
} from 'cf-react-internet-status';

function ConnectionBanner() {
  const { isOnline } = useInternetStatusContext();
  return isOnline ? <p>Connected.</p> : <p>No internet connection.</p>;
}

function App() {
  return (
    <InternetStatusProvider probe={{ url: '/api/health' }}>
      <ConnectionBanner />
    </InternetStatusProvider>
  );
}
```

> **The hook must be called in a component _below_ the provider** — not in the
> same component that renders it. A component cannot consume a context it
> renders itself.

### Ready-made components

```tsx
import { InternetStatus, Online, Offline } from 'cf-react-internet-status';

<InternetStatus hideWhenOnline variant="banner" position="top" />

<Offline>
  <p>You are offline. Changes will not be saved.</p>
</Offline>
```

These work with or without a provider.

## Reachability probing

While `navigator.onLine` is `true`, the store periodically requests a URL. If
the request comes back, the internet is reachable; if it times out or fails,
it isn't.

- **Default probe URL: `/favicon.ico`** — same-origin, so no CORS setup, no
  third-party dependency, and no unannounced outbound request from your app.
  For most apps "can I reach my own server?" is the question that matters.
- Probing **stops entirely** while `navigator.onLine` is `false` — no point.
- Failures back off exponentially (2s → 4s → 8s …, capped).
- Probing **pauses while the tab is hidden** and re-checks on focus, tab
  visibility, and bfcache restore if the last check is stale.
- Flapping is damped: one success promotes to reachable immediately, but
  `failureThreshold` (default 2) consecutive failures are required to declare
  it unreachable.

```tsx
<InternetStatusProvider
  probe={{ url: '/api/health', mode: 'cors', intervalMs: 15_000 }}
/>
```

If your app is served from a static CDN, point it somewhere with CORS:
`https://www.cloudflare.com/cdn-cgi/trace`, or
`https://www.gstatic.com/generate_204` with `mode: 'no-cors'`.

Disable probing entirely with `enableProbe={false}` — `isInternetReachable`
then just mirrors `isOnline`.

### `isOnline` vs `isInternetReachable`

| `isOnline` | `isInternetReachable` | `status`     | Meaning                              |
| ---------- | --------------------- | ------------ | ------------------------------------ |
| `true`     | `null`                | `'checking'` | Interface up, first probe in flight  |
| `true`     | `true`                | `'online'`   | Verified working                     |
| `true`     | `false`               | `'offline'`  | Captive portal / dead WAN / DNS down |
| `false`    | `false`               | `'offline'`  | Interface down                       |

Render off `status` unless you specifically need the distinction.

## API

### `useInternetStatus(options?)`

Returns `InternetStatusState & { recheck }`.

| Field                 | Type                                               | Description                                  |
| --------------------- | -------------------------------------------------- | -------------------------------------------- |
| `isOnline`            | `boolean`                                          | `navigator.onLine`.                          |
| `isInternetReachable` | `boolean \| null`                                  | Probe-verified. `null` while unknown.        |
| `status`              | `'online' \| 'offline' \| 'checking' \| 'unknown'` | Derived rollup — render off this.            |
| `isChecking`          | `boolean`                                          | A probe is in flight.                        |
| `since`               | `number`                                           | Epoch ms of the last `status` change.        |
| `lastCheckedAt`       | `number \| null`                                   | Epoch ms of the last completed probe.        |
| `failureCount`        | `number`                                           | Consecutive probe failures.                  |
| `connection`          | `ConnectionInfo \| null`                           | Network Information API data.                |
| `isSlow`              | `boolean`                                          | Heuristic over `connection`.                 |
| `recheck()`           | `() => Promise<boolean>`                           | Probe now. Dedupes with any in-flight check. |

Options are read **once**, on first render. Passing options creates a store
private to that call site; omitting them shares the default store.

### `useInternetStatusContext()`

Same shape, read from the nearest provider. Throws if there isn't one.

### `useOnReconnect(callback, options?)`

Fires on the offline → online edge — the usual reason being "refetch what went
stale". The callback receives `{ offlineDurationMs, state }`.

```tsx
useOnReconnect(({ offlineDurationMs }) => {
  void refetch();
  toast(`Back online after ${Math.round(offlineDurationMs / 1000)}s`);
});
```

| Option             | Type      | Default | Description                                     |
| ------------------ | --------- | ------- | ----------------------------------------------- |
| `fireOnMount`      | `boolean` | `false` | Also fire on mount if already connected.        |
| `requireReachable` | `boolean` | `true`  | Wait for probe verification, not just `onLine`. |

### `useNetworkQuality()`

`ConnectionInfo & { isSlow, isUnsupported }` — `effectiveType`, `downlink`
(Mbps), `rtt` (ms), `saveData`, `type`. **Chromium-only**: elsewhere every
field is `null`/`false` and `isUnsupported` is `true`. Never throws.

### `useOfflineDuration(intervalMs?)`

Live ms counter while offline, `0` while connected. Opt-in and separate from
the snapshot on purpose — a ticking value in the store would re-render every
consumer once per second.

### `<InternetStatusProvider>`

Accepts every `InternetStatusOptions` field, plus:

| Prop        | Type                        | Description                                   |
| ----------- | --------------------------- | --------------------------------------------- |
| `store`     | `NetworkStore`              | Inject a pre-built store (tests, multi-root). |
| `onOnline`  | `(state) => void`           | Fired on transition to online.                |
| `onOffline` | `(state) => void`           | Fired on transition to offline.               |
| `onChange`  | `(state, previous) => void` | Fired on any status change.                   |

Callbacks are ref-latched: inline arrows do not cause re-subscription. They do
not fire on mount.

### `<InternetStatus>`

| Prop              | Type                               | Default    | Description                                              |
| ----------------- | ---------------------------------- | ---------- | -------------------------------------------------------- |
| `className`       | `string`                           | —          | On the wrapper.                                          |
| `style`           | `CSSProperties`                    | —          | On the wrapper.                                          |
| `as`              | `ElementType`                      | `'div'`    | Wrapper element.                                         |
| `online`          | `ReactNode`                        | built-in   | Content while online.                                    |
| `offline`         | `ReactNode`                        | built-in   | Content while offline.                                   |
| `checking`        | `ReactNode`                        | built-in   | Content during the first probe.                          |
| `unknown`         | `ReactNode`                        | built-in   | Content before anything is known.                        |
| `children`        | `(state) => ReactNode`             | —          | Render-prop. Wins over the above; drops the wrapper.     |
| `hideWhenOnline`  | `boolean`                          | `false`    | Render nothing while connected.                          |
| `useReachability` | `boolean`                          | `true`     | `false` restores v1 semantics (`navigator.onLine` only). |
| `autoDismissMs`   | `number`                           | —          | Hide the _connected_ message after N ms.                 |
| `variant`         | `'inline' \| 'banner' \| 'toast'`  | `'inline'` | Layout.                                                  |
| `position`        | `'top' \| 'bottom'`                | `'top'`    | For banner/toast.                                        |
| `unstyled`        | `boolean`                          | `false`    | Emit no inline styles.                                   |
| `role`            | `string`                           | auto       | Overrides the default ARIA role.                         |
| `aria-live`       | `'off' \| 'polite' \| 'assertive'` | auto       | Overrides the default politeness.                        |

Accessible by default: offline gets `role="alert"` + `aria-live="assertive"`;
everything else gets `role="status"` + `aria-live="polite"`.

### `<Online>` / `<Offline>`

Render children only on the matching state. Both accept `useReachability`.

### Advanced

`createNetworkStore(options)`, `getDefaultStore()` and `resetDefaultStore()`
expose the underlying store — for sharing one across React roots, driving it
from tests, or integrating with non-React code.

### TanStack Query

```ts
import { onlineManager } from '@tanstack/react-query';
import { setupOnlineManager } from 'cf-react-internet-status';

setupOnlineManager(onlineManager, { probe: { url: '/api/health' } });
```

Query pausing/resuming and persisted mutations now follow real connectivity.
A durable offline mutation queue is deliberately **out of scope** here —
TanStack Query, RTK Query and Workbox Background Sync already solve it
properly, and a half-implementation would risk data loss.

## SSR & hydration

Safe under Next.js, Remix and any `renderToString` setup.

- Nothing touches `navigator` at import time or during render.
- `getServerSnapshot()` returns a frozen module constant with `isOnline: true`
  and `status: 'unknown'` — optimistic on purpose, so an offline banner is
  never baked into server HTML.
- The client subscribes after hydration and corrects the state then. This is
  `useSyncExternalStore` working as designed, not a mismatch.
- The bundle carries a `'use client'` directive, so App Router consumers can
  import it directly.

Note that a bare `typeof navigator !== 'undefined'` guard is **not** enough on
modern Node: Node 21+ defines `globalThis.navigator` without `onLine`. This
package checks the property itself.

## Caveats

- With `mode: 'no-cors'` the response is opaque — a captive portal's 200 is
  indistinguishable from a real one. Point the probe at an endpoint you control
  with `mode: 'cors'` if that matters.
- Probing costs requests and battery. Tune `intervalMs`, or set it to `0` for
  event-driven-only checks.
- `navigator.connection` is Chromium-only. `useNetworkQuality` degrades to
  nulls rather than throwing.
- The probe answers "is _that URL_ reachable". It won't detect "the internet is
  fine but my API is down" unless you point it at your API.

## Migrating from v1

| v1                                        | v2                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `useInternetStatus()` → `boolean`         | → `{ isOnline, status, ... }`. Use `.isOnline`.                                              |
| React 17 supported                        | React 18+ required (`useSyncExternalStore`).                                                 |
| `<InternetStatus/>` needs a provider      | Works standalone too.                                                                        |
| `<InternetStatus/>` renders a plain `div` | Adds ARIA roles and reachability awareness. `useReachability={false}` restores v1 behaviour. |
| Deep imports into `dist/`                 | Blocked by the `exports` map — import from the root.                                         |

`useInternetStatusContext()` still returns `{ isOnline }` (plus new fields), so
existing destructuring keeps working.

## License

MIT © Ridel Saavedra Flores
