import { describe, it, expect, vi } from 'vitest';
import { memo, useState } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { InternetStatusProvider } from '../src/context/InternetStatusProvider';
import { useInternetStatusContext } from '../src/hooks/useInternetStatusContext';
import { setOnline } from './setup';

describe('InternetStatusProvider', () => {
  it('throws a helpful error when the hook is used outside a provider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Orphan() {
      useInternetStatusContext();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(
      /must be used within an InternetStatusProvider/
    );
    errorSpy.mockRestore();
  });

  it('provides the status to descendants', () => {
    function Child() {
      const { isOnline } = useInternetStatusContext();
      return <span data-testid="status">{String(isOnline)}</span>;
    }
    render(
      <InternetStatusProvider enableProbe={false}>
        <Child />
      </InternetStatusProvider>
    );
    expect(screen.getByTestId('status')).toHaveTextContent('true');

    act(() => setOnline(false));
    expect(screen.getByTestId('status')).toHaveTextContent('false');
  });

  it('does not re-render consumers when the provider parent re-renders', () => {
    const renders = vi.fn();
    const Consumer = memo(function Consumer() {
      useInternetStatusContext();
      renders();
      return null;
    });

    let bump!: () => void;
    function Parent() {
      const [, setTick] = useState(0);
      bump = () => setTick((t) => t + 1);
      return (
        <InternetStatusProvider enableProbe={false}>
          <Consumer />
        </InternetStatusProvider>
      );
    }

    render(<Parent />);
    const initial = renders.mock.calls.length;

    act(() => bump());
    act(() => bump());
    expect(renders.mock.calls.length).toBe(initial);

    act(() => setOnline(false));
    expect(renders.mock.calls.length).toBeGreaterThan(initial);
  });

  it('fires onOffline and onOnline on transitions', () => {
    const onOnline = vi.fn();
    const onOffline = vi.fn();
    const onChange = vi.fn();

    render(
      <InternetStatusProvider
        enableProbe={false}
        onOnline={onOnline}
        onOffline={onOffline}
        onChange={onChange}
      />
    );

    // No synthetic events on mount.
    expect(onOnline).not.toHaveBeenCalled();
    expect(onOffline).not.toHaveBeenCalled();

    act(() => setOnline(false));
    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({ status: 'offline' });
    expect(onChange.mock.calls[0]?.[1]).toMatchObject({ status: 'online' });

    act(() => setOnline(true));
    expect(onOnline).toHaveBeenCalledTimes(1);
  });

  it('does not fire callbacks on a redundant same-status event', () => {
    const onChange = vi.fn();
    render(
      <InternetStatusProvider enableProbe={false} onChange={onChange} />
    );
    act(() => setOnline(true));
    act(() => setOnline(true));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not double-register listeners when providers are nested', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(
      <InternetStatusProvider enableProbe={false}>
        <span />
      </InternetStatusProvider>
    );
    const count = addSpy.mock.calls.filter(([t]) => t === 'online').length;
    expect(count).toBe(1);
  });

  it('exposes recheck() through the context', async () => {
    const fetchMock = vi.fn(
      () => Promise.resolve({ type: 'basic', ok: true, status: 200 } as Response)
    );
    let recheck!: () => Promise<boolean>;
    function Child() {
      const ctx = useInternetStatusContext();
      recheck = ctx.recheck;
      return <span data-testid="status">{ctx.status}</span>;
    }

    render(
      <InternetStatusProvider probe={{ fetch: fetchMock, jitter: 0 }}>
        <Child />
      </InternetStatusProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('online')
    );

    fetchMock.mockClear();
    await act(async () => {
      await recheck();
    });
    expect(fetchMock).toHaveBeenCalled();
  });
});
