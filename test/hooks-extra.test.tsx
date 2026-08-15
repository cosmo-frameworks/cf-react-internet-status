import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { InternetStatusProvider } from '../src/context/InternetStatusProvider';
import { useOnReconnect } from '../src/hooks/useOnReconnect';
import { useOfflineDuration } from '../src/hooks/useOfflineDuration';
import { useNetworkQuality } from '../src/hooks/useNetworkQuality';
import { setupOnlineManager } from '../src/integrations/tanstack-query';
import { setOnline, okResponse } from './setup';

const wrap = (ui: ReactNode) =>
  render(
    <InternetStatusProvider enableProbe={false}>{ui}</InternetStatusProvider>
  );

describe('useOnReconnect', () => {
  it('fires on the offline → online edge only', () => {
    const onReconnect = vi.fn();
    function Consumer() {
      useOnReconnect(onReconnect);
      return null;
    }
    wrap(<Consumer />);

    expect(onReconnect).not.toHaveBeenCalled(); // no mount event by default

    act(() => setOnline(false));
    expect(onReconnect).not.toHaveBeenCalled();

    act(() => setOnline(true));
    expect(onReconnect).toHaveBeenCalledTimes(1);
    expect(
      onReconnect.mock.calls[0]?.[0].offlineDurationMs
    ).toBeGreaterThanOrEqual(0);
  });

  it('fires on mount when asked', () => {
    const onReconnect = vi.fn();
    function Consumer() {
      useOnReconnect(onReconnect, { fireOnMount: true });
      return null;
    }
    wrap(<Consumer />);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire when passed a new inline arrow each render', () => {
    let calls = 0;
    function Consumer({ tick }: { tick: number }) {
      useOnReconnect(() => {
        calls += 1;
      });
      return <span>{tick}</span>;
    }
    const { rerender } = wrap(<Consumer tick={0} />);
    rerender(
      <InternetStatusProvider enableProbe={false}>
        <Consumer tick={1} />
      </InternetStatusProvider>
    );

    act(() => setOnline(false));
    act(() => setOnline(true));
    expect(calls).toBe(1);
  });
});

describe('useOfflineDuration', () => {
  it('counts while offline and resets when back online', () => {
    vi.useFakeTimers();
    function Consumer() {
      const ms = useOfflineDuration(1_000);
      return <span data-testid="ms">{ms > 0 ? 'counting' : 'zero'}</span>;
    }
    wrap(<Consumer />);
    expect(screen.getByTestId('ms')).toHaveTextContent('zero');

    act(() => setOnline(false));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(screen.getByTestId('ms')).toHaveTextContent('counting');

    act(() => setOnline(true));
    expect(screen.getByTestId('ms')).toHaveTextContent('zero');
    vi.useRealTimers();
  });
});

describe('useNetworkQuality', () => {
  it('degrades gracefully where the Network Information API is missing', () => {
    function Consumer() {
      const q = useNetworkQuality();
      return (
        <span data-testid="q">
          {String(q.isUnsupported)}:{String(q.isSlow)}:{String(q.effectiveType)}
        </span>
      );
    }
    wrap(<Consumer />);
    // jsdom exposes no navigator.connection — must be null/false, never throw.
    expect(screen.getByTestId('q')).toHaveTextContent('true:false:null');
  });
});

describe('setupOnlineManager', () => {
  it('drives an onlineManager from probe-verified connectivity', async () => {
    const fetchMock = vi.fn(() => okResponse());
    const setOnlineSpy = vi.fn();

    const teardown = setupOnlineManager(
      { setOnline: setOnlineSpy },
      { probe: { fetch: fetchMock, jitter: 0, failureThreshold: 1 } }
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(setOnlineSpy).toHaveBeenCalledWith(true);

    setOnlineSpy.mockClear();
    setOnline(false);

    await waitFor(() => expect(setOnlineSpy).toHaveBeenCalledWith(false));
    teardown();
  });
});
