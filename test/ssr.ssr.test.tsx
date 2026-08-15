/**
 * Runs in a real Node environment (no jsdom globals) — see vitest.config.ts.
 *
 * v1.0.0 read `navigator.onLine` during render with no guard, which threw
 * `ReferenceError: navigator is not defined` under Next.js/Remix.
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { InternetStatusProvider } from '../src/context/InternetStatusProvider';
import { useInternetStatusContext } from '../src/hooks/useInternetStatusContext';
import { InternetStatus } from '../src/components/InternetStatus';
import { Online, Offline } from '../src/components/OnlineOffline';
import { useInternetStatus } from '../src/hooks/useInternetStatus';
import { createNetworkStore, SERVER_SNAPSHOT } from '../src/core/store';
import { canUseDOM, readOnLine } from '../src/core/env';

describe('server rendering', () => {
  it('has no DOM globals in this environment', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(canUseDOM()).toBe(false);
  });

  it('readOnLine falls back to true when navigator.onLine is unavailable', () => {
    // Node 21+ DOES define globalThis.navigator, but without `onLine` — a bare
    // `typeof navigator !== 'undefined'` guard would pass here and yield
    // `undefined`. This asserts we probe the property itself.
    expect(readOnLine()).toBe(true);
  });

  it('getServerSnapshot returns a stable, deterministic reference', () => {
    const store = createNetworkStore();
    // A fresh object or a Date.now() in here breaks hydration and can loop.
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(store.getServerSnapshot()).toBe(SERVER_SNAPSHOT);
    expect(SERVER_SNAPSHOT.since).toBe(0);
  });

  it('subscribing on the server starts nothing', () => {
    const store = createNetworkStore();
    expect(() => store.subscribe(() => undefined)()).not.toThrow();
  });

  it('renders the provider and component without throwing', () => {
    let html = '';
    expect(() => {
      html = renderToString(
        <InternetStatusProvider>
          <InternetStatus />
        </InternetStatusProvider>
      );
    }).not.toThrow();
    // Optimistic server snapshot: never bake an offline banner into markup.
    expect(html).not.toContain('You are offline!');
  });

  it('renders the raw hook without a provider and without throwing', () => {
    function Probe() {
      const { isOnline } = useInternetStatus();
      return <span>{String(isOnline)}</span>;
    }
    expect(() => renderToString(<Probe />)).not.toThrow();
    expect(renderToString(<Probe />)).toContain('true');
  });

  it('renders a context consumer below the provider', () => {
    function Child() {
      const { isOnline } = useInternetStatusContext();
      return <span>{String(isOnline)}</span>;
    }
    const html = renderToString(
      <InternetStatusProvider>
        <Child />
      </InternetStatusProvider>
    );
    expect(html).toContain('true');
  });

  it('renders <Online>/<Offline> without throwing', () => {
    const html = renderToString(
      <InternetStatusProvider>
        <Online>
          <span>up</span>
        </Online>
        <Offline>
          <span>down</span>
        </Offline>
      </InternetStatusProvider>
    );
    expect(html).not.toContain('down');
  });
});
