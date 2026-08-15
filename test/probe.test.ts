import { describe, it, expect, vi, afterEach } from 'vitest';
import { createNetworkStore } from '../src/core/store';
import { probeOnce } from '../src/core/probe';
import { setOnline, setHidden, okResponse } from './setup';

const base = {
  method: 'HEAD' as const,
  mode: 'no-cors' as RequestMode,
  timeoutMs: 5_000,
  cacheBust: true,
};

afterEach(() => vi.useRealTimers());

describe('probeOnce', () => {
  it('treats an opaque response as reachable', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ type: 'opaque', ok: false, status: 0 } as Response)
    );
    // With mode:'no-cors' the status is always 0 and unreadable — resolution
    // itself is the signal.
    await expect(
      probeOnce('/favicon.ico', { ...base, fetch: fetchMock })
    ).resolves.toBe(true);
  });

  it('treats a network failure as unreachable', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('failed')));
    await expect(
      probeOnce('/favicon.ico', { ...base, fetch: fetchMock })
    ).resolves.toBe(false);
  });

  it('treats a 5xx as unreachable', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ type: 'basic', ok: false, status: 503 } as Response)
    );
    await expect(
      probeOnce('/health', { ...base, mode: 'cors', fetch: fetchMock })
    ).resolves.toBe(false);
  });

  it('aborts on timeout and reports unreachable', async () => {
    let aborted = false;
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );

    const result = await probeOnce('/favicon.ico', {
      ...base,
      timeoutMs: 10,
      fetch: fetchMock as unknown as typeof fetch,
    });

    expect(aborted).toBe(true);
    expect(result).toBe(false);
  });

  it('sets no-store and appends a cache-busting parameter', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      okResponse()
    );
    await probeOnce('/favicon.ico', { ...base, fetch: fetchMock });

    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(typeof input).toBe('string');
    expect(input as string).toContain('_cfis=');
    expect(init?.cache).toBe('no-store');
    expect(init?.method).toBe('HEAD');
    expect(init?.credentials).toBe('omit');
  });

  it('skips the cache-busting parameter when disabled', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      okResponse()
    );
    await probeOnce('/favicon.ico', {
      ...base,
      cacheBust: false,
      fetch: fetchMock,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/favicon.ico');
  });
});

describe('store probing', () => {
  it('probes on start and marks the connection reachable', async () => {
    const fetchMock = vi.fn(() => okResponse());
    const store = createNetworkStore({
      probe: { fetch: fetchMock, jitter: 0 },
    });
    const unsubscribe = store.subscribe(() => undefined);

    await store.recheck();
    expect(fetchMock).toHaveBeenCalled();
    expect(store.getSnapshot().isInternetReachable).toBe(true);
    expect(store.getSnapshot().status).toBe('online');

    unsubscribe();
  });

  it('requires failureThreshold consecutive failures before flipping', async () => {
    let reachable = true;
    const fetchMock = vi.fn(() =>
      reachable ? okResponse() : Promise.reject(new TypeError('down'))
    );
    const store = createNetworkStore({
      probe: { fetch: fetchMock, jitter: 0, failureThreshold: 2 },
    });
    const unsubscribe = store.subscribe(() => undefined);
    await store.recheck();
    expect(store.getSnapshot().isInternetReachable).toBe(true);

    reachable = false;

    await store.recheck();
    // One failure is not enough — this is the anti-flap guard.
    expect(store.getSnapshot().isInternetReachable).toBe(true);
    expect(store.getSnapshot().failureCount).toBe(1);

    await store.recheck();
    expect(store.getSnapshot().isInternetReachable).toBe(false);
    expect(store.getSnapshot().status).toBe('offline');

    unsubscribe();
  });

  it('promotes to reachable on the first success and resets the counter', async () => {
    let reachable = false;
    const fetchMock = vi.fn(() =>
      reachable ? okResponse() : Promise.reject(new TypeError('down'))
    );
    const store = createNetworkStore({
      probe: { fetch: fetchMock, jitter: 0, failureThreshold: 1 },
    });
    const unsubscribe = store.subscribe(() => undefined);
    await store.recheck();
    expect(store.getSnapshot().isInternetReachable).toBe(false);

    reachable = true;
    await store.recheck();

    expect(store.getSnapshot().isInternetReachable).toBe(true);
    expect(store.getSnapshot().failureCount).toBe(0);

    unsubscribe();
  });

  it('dedupes concurrent recheck() calls', async () => {
    let resolveFetch!: (r: Response) => void;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve))
    );
    const store = createNetworkStore({
      probe: { fetch: fetchMock, jitter: 0 },
      enableProbe: true,
    });
    const unsubscribe = store.subscribe(() => undefined);

    const a = store.recheck();
    const b = store.recheck();
    expect(a).toBe(b); // same in-flight promise

    resolveFetch({ type: 'basic', ok: true, status: 200 } as Response);
    await a;
    // The start-up probe plus this one — never two for the same recheck pair.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);

    unsubscribe();
  });

  it('marks isChecking while a probe is in flight', async () => {
    let resolveFetch!: (r: Response) => void;
    const fetchMock = vi.fn(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve))
    );
    const store = createNetworkStore({
      probe: { fetch: fetchMock, jitter: 0 },
    });
    const unsubscribe = store.subscribe(() => undefined);

    const pending = store.recheck();
    expect(store.getSnapshot().isChecking).toBe(true);
    expect(store.getSnapshot().status).toBe('checking');

    resolveFetch({ type: 'basic', ok: true, status: 200 } as Response);
    await pending;
    expect(store.getSnapshot().isChecking).toBe(false);

    unsubscribe();
  });

  it('stops probing when the interface goes down', async () => {
    const fetchMock = vi.fn(() => okResponse());
    const store = createNetworkStore({
      probe: { fetch: fetchMock, jitter: 0 },
    });
    const unsubscribe = store.subscribe(() => undefined);
    await store.recheck();

    setOnline(false);
    fetchMock.mockClear();

    await store.recheck();
    expect(fetchMock).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('pauses scheduling while the document is hidden', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => okResponse());
    const store = createNetworkStore({
      probe: { fetch: fetchMock, jitter: 0, intervalMs: 1_000 },
      pauseWhenHidden: true,
    });
    const unsubscribe = store.subscribe(() => undefined);

    await vi.advanceTimersByTimeAsync(0); // let the start-up probe settle
    setHidden(true);
    fetchMock.mockClear();

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchMock).not.toHaveBeenCalled();

    unsubscribe();
  });

  it('backs off exponentially after failures', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('down')));
    const store = createNetworkStore({
      probe: {
        fetch: fetchMock,
        jitter: 0,
        intervalMs: 100_000,
        retryIntervalMs: 1_000,
        maxRetryIntervalMs: 8_000,
        failureThreshold: 1,
      },
    });
    const unsubscribe = store.subscribe(() => undefined);

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // start-up probe failed

    // failureCount 1 → 1000ms
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // failureCount 2 → 2000ms
    await vi.advanceTimersByTimeAsync(1_999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // failureCount 3 → 4000ms
    await vi.advanceTimersByTimeAsync(4_000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    unsubscribe();
  });

  it('honours a custom probe function', async () => {
    const custom = vi.fn(() => Promise.resolve(false));
    const store = createNetworkStore({
      probe: { probe: custom, jitter: 0, failureThreshold: 1 },
    });
    const unsubscribe = store.subscribe(() => undefined);

    await store.recheck();
    expect(custom).toHaveBeenCalled();
    expect(store.getSnapshot().isInternetReachable).toBe(false);

    unsubscribe();
  });
});
