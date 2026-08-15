/**
 * The README's examples, copied verbatim.
 *
 * v1.0.0 documented an example that threw at runtime (it called the context
 * hook in the same component that rendered the provider). This file exists so
 * that can never ship again: if an example breaks, CI goes red.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InternetStatusProvider } from '../src/context/InternetStatusProvider';
import { useInternetStatusContext } from '../src/hooks/useInternetStatusContext';
import { useInternetStatus } from '../src/hooks/useInternetStatus';
import { InternetStatus } from '../src/components/InternetStatus';
import { Online, Offline } from '../src/components/OnlineOffline';
import { useOnReconnect } from '../src/hooks/useOnReconnect';
import { flushProbes } from './setup';

describe('README examples', () => {
  it('quick start: provider-free hook', async () => {
    function ConnectionBanner() {
      const { status } = useInternetStatus();
      return <p>{status === 'offline' ? 'No connection' : 'Connected'}</p>;
    }

    expect(() => render(<ConnectionBanner />)).not.toThrow();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    await flushProbes();
  });

  it('with a provider', () => {
    function ConnectionBanner() {
      const { isOnline } = useInternetStatusContext();
      return isOnline ? <p>Connected.</p> : <p>No internet connection.</p>;
    }

    function App() {
      return (
        <InternetStatusProvider enableProbe={false}>
          <ConnectionBanner />
        </InternetStatusProvider>
      );
    }

    expect(() => render(<App />)).not.toThrow();
    expect(screen.getByText('Connected.')).toBeInTheDocument();
  });

  it('ready-made components, with no provider', async () => {
    expect(() =>
      render(
        <>
          <InternetStatus hideWhenOnline variant="banner" position="top" />
          <Offline>
            <p>You are offline. Changes will not be saved.</p>
          </Offline>
          <Online>
            <p>All good.</p>
          </Online>
        </>
      )
    ).not.toThrow();
    await flushProbes();
  });

  it('useOnReconnect recipe', () => {
    const refetch = vi.fn();
    function Consumer() {
      useOnReconnect(() => {
        refetch();
      });
      return null;
    }
    expect(() =>
      render(
        <InternetStatusProvider enableProbe={false}>
          <Consumer />
        </InternetStatusProvider>
      )
    ).not.toThrow();
  });
});
