import { describe, it, expect, vi } from 'vitest';
import { createNetworkStore, SERVER_SNAPSHOT } from '../src/core/store';
import { setOnline, setOnlineSilently, okResponse } from './setup';

const noProbe = { enableProbe: false } as const;

describe('createNetworkStore', () => {
  it('returns a stable snapshot reference while nothing changes', () => {
    const store = createNetworkStore(noProbe);
    const unsubscribe = store.subscribe(() => undefined);

    const a = store.getSnapshot();
    const b = store.getSnapshot();
    // useSyncExternalStore throws "The result of getSnapshot should be cached"
    // and loops forever if these differ.
    expect(a).toBe(b);

    unsubscribe();
  });

  it('returns a stable server snapshot reference', () => {
    const store = createNetworkStore(noProbe);
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(store.getServerSnapshot()).toBe(SERVER_SNAPSHOT);
    // Optimistic, and deterministic across renders.
    expect(SERVER_SNAPSHOT.isOnline).toBe(true);
    expect(SERVER_SNAPSHOT.since).toBe(0);
  });

  it('starts listeners on the first subscriber only', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const store = createNetworkStore(noProbe);

    const un1 = store.subscribe(() => undefined);
    const afterFirst = addSpy.mock.calls.filter(
      ([type]) => type === 'online' || type === 'offline'
    ).length;

    const un2 = store.subscribe(() => undefined);
    const afterSecond = addSpy.mock.calls.filter(
      ([type]) => type === 'online' || type === 'offline'
    ).length;

    expect(afterFirst).toBe(2);
    expect(afterSecond).toBe(2); // refcounted — no duplicate registration

    un1();
    un2();
  });

  it('removes every listener when the last subscriber leaves', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const store = createNetworkStore(noProbe);

    const un1 = store.subscribe(() => undefined);
    const un2 = store.subscribe(() => undefined);

    un1();
    expect(removeSpy).not.toHaveBeenCalled();

    un2();
    const removed = removeSpy.mock.calls.map(([type]) => type);
    expect(removed).toContain('online');
    expect(removed).toContain('offline');
    expect(removed).toContain('focus');
  });

  it('re-reads navigator.onLine on start, catching a missed event', () => {
    // The value flipped with no event dispatched — nothing will replay it,
    // so the store must read it itself when it starts.
    setOnlineSilently(false);

    const store = createNetworkStore(noProbe);
    const unsubscribe = store.subscribe(() => undefined);

    expect(store.getSnapshot().isOnline).toBe(false);
    expect(store.getSnapshot().status).toBe('offline');

    unsubscribe();
  });

  it('notifies subscribers on a real transition', () => {
    const store = createNetworkStore(noProbe);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    listener.mockClear();

    setOnline(false);
    expect(listener).toHaveBeenCalled();
    expect(store.getSnapshot().status).toBe('offline');

    unsubscribe();
  });

  it('mirrors isOnline into isInternetReachable when probing is disabled', () => {
    const store = createNetworkStore(noProbe);
    const unsubscribe = store.subscribe(() => undefined);

    expect(store.getSnapshot().isInternetReachable).toBe(true);
    expect(store.getSnapshot().status).toBe('online');

    unsubscribe();
  });

  it('stamps `since` only on real status changes', async () => {
    const store = createNetworkStore(noProbe);
    const unsubscribe = store.subscribe(() => undefined);

    const first = store.getSnapshot().since;
    // A redundant event with no actual change must not move the timestamp.
    setOnline(true);
    expect(store.getSnapshot().since).toBe(first);

    await new Promise((r) => setTimeout(r, 5));
    setOnline(false);
    expect(store.getSnapshot().since).toBeGreaterThan(first);

    unsubscribe();
  });

  it('destroy() drops subscribers and tears everything down', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const store = createNetworkStore(noProbe);
    store.subscribe(() => undefined);

    store.destroy();
    expect(removeSpy.mock.calls.map(([t]) => t)).toContain('online');
  });

  it('never probes while the interface is down', async () => {
    const probeFetch = vi.fn(() => okResponse());
    setOnlineSilently(false);

    const store = createNetworkStore({
      probe: { fetch: probeFetch, jitter: 0 },
    });
    const unsubscribe = store.subscribe(() => undefined);

    await store.recheck();
    expect(probeFetch).not.toHaveBeenCalled();
    expect(store.getSnapshot().isInternetReachable).toBe(false);

    unsubscribe();
  });
});
