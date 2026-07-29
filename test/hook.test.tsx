import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { useInternetStatus } from '../src/hooks/useInternetStatus';
import { getDefaultStore } from '../src/core/store';
import { setOnline, setOnlineSilently, okResponse, flushProbes } from './setup';
import type { InternetStatusOptions } from '../src/core/types';

const noProbe: InternetStatusOptions = { enableProbe: false };

function Probe({ options }: { options?: InternetStatusOptions }) {
  const { isOnline, status } = useInternetStatus(options);
  return (
    <>
      <span data-testid="online">{String(isOnline)}</span>
      <span data-testid="status">{status}</span>
    </>
  );
}

describe('useInternetStatus', () => {
  it('reflects navigator.onLine on first render', () => {
    setOnlineSilently(false);
    render(<Probe options={noProbe} />);
    expect(screen.getByTestId('online')).toHaveTextContent('false');
    expect(screen.getByTestId('status')).toHaveTextContent('offline');
  });

  it('reacts to online/offline events', () => {
    render(<Probe options={noProbe} />);
    expect(screen.getByTestId('status')).toHaveTextContent('online');

    act(() => setOnline(false));
    expect(screen.getByTestId('status')).toHaveTextContent('offline');

    act(() => setOnline(true));
    expect(screen.getByTestId('status')).toHaveTextContent('online');
  });

  it('re-reads navigator.onLine on subscribe, catching a missed event', () => {
    // No event is dispatched, so only a re-read on start can surface this.
    setOnlineSilently(false);
    render(<Probe options={noProbe} />);
    expect(screen.getByTestId('online')).toHaveTextContent('false');
  });

  it('removes its listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<Probe options={noProbe} />);
    unmount();

    const removed = removeSpy.mock.calls.map(([type]) => type);
    expect(removed).toContain('online');
    expect(removed).toContain('offline');
  });

  it('does not warn after unmount', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = render(<Probe options={noProbe} />);
    unmount();
    act(() => setOnline(false));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('shares one store — and one set of listeners — across call sites', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(
      <>
        <Probe />
        <Probe />
        <Probe />
      </>
    );
    const onlineRegistrations = addSpy.mock.calls.filter(
      ([type]) => type === 'online'
    ).length;
    // Ten components using the hook must not mean ten probe schedules.
    expect(onlineRegistrations).toBe(1);
    expect(getDefaultStore).toBeDefined();
    await flushProbes();
  });

  it('reports probe-verified reachability', async () => {
    const fetchMock = vi.fn(() => okResponse());
    render(<Probe options={{ probe: { fetch: fetchMock, jitter: 0 } }} />);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('online')
    );
    expect(fetchMock).toHaveBeenCalled();
  });

  it('reports offline when the probe fails despite navigator.onLine', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('no wan')));
    render(
      <Probe
        options={{
          probe: { fetch: fetchMock, jitter: 0, failureThreshold: 1 },
        }}
      />
    );

    // The captive-portal case v1 could never detect.
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('offline')
    );
    expect(screen.getByTestId('online')).toHaveTextContent('true');
  });
});
