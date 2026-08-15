import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, act } from '@testing-library/react';
import { InternetStatus } from '../src/components/InternetStatus';
import { Online, Offline } from '../src/components/OnlineOffline';
import { InternetStatusProvider } from '../src/context/InternetStatusProvider';
import { setOnline, flushProbes } from './setup';

const wrap = (ui: ReactNode) =>
  render(
    <InternetStatusProvider enableProbe={false}>{ui}</InternetStatusProvider>
  );

describe('<InternetStatus>', () => {
  it('renders the default online and offline messages', () => {
    wrap(<InternetStatus />);
    expect(screen.getByText('You are online!')).toBeInTheDocument();

    act(() => setOnline(false));
    expect(screen.getByText('You are offline!')).toBeInTheDocument();
  });

  it('works without a provider', async () => {
    // No provider → falls back to the shared default store, where probing is
    // on, so the probe has to be flushed inside act.
    expect(() => render(<InternetStatus />)).not.toThrow();
    await flushProbes();
  });

  it('accepts custom nodes per state', () => {
    wrap(<InternetStatus online={<em>up</em>} offline={<em>down</em>} />);
    expect(screen.getByText('up')).toBeInTheDocument();

    act(() => setOnline(false));
    expect(screen.getByText('down')).toBeInTheDocument();
  });

  it('applies className and style to the wrapper', () => {
    const { container } = wrap(
      <InternetStatus className="banner" style={{ padding: '4px' }} />
    );
    const wrapper = container.querySelector('div.banner');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveStyle({ padding: '4px' });
  });

  it('renders nothing while online with hideWhenOnline', () => {
    const { container } = wrap(<InternetStatus hideWhenOnline />);
    expect(container).toBeEmptyDOMElement();

    act(() => setOnline(false));
    expect(screen.getByText('You are offline!')).toBeInTheDocument();
  });

  it('supports a render-prop that receives the full state', () => {
    wrap(
      <InternetStatus>
        {({ isOnline, status, recheck }) => (
          <span data-testid="rp">
            {String(isOnline)}:{status}:{typeof recheck}
          </span>
        )}
      </InternetStatus>
    );
    expect(screen.getByTestId('rp')).toHaveTextContent('true:online:function');
  });

  it('announces offline assertively and online politely', () => {
    const { container } = wrap(<InternetStatus />);
    expect(container.firstElementChild).toHaveAttribute('role', 'status');
    expect(container.firstElementChild).toHaveAttribute('aria-live', 'polite');

    act(() => setOnline(false));
    expect(container.firstElementChild).toHaveAttribute('role', 'alert');
    expect(container.firstElementChild).toHaveAttribute(
      'aria-live',
      'assertive'
    );
  });

  it('emits no inline styles when unstyled', () => {
    const { container } = wrap(<InternetStatus variant="banner" unstyled />);
    expect(container.firstElementChild).not.toHaveAttribute('style');
  });

  it('positions a banner variant', () => {
    const { container } = wrap(<InternetStatus variant="banner" />);
    expect(container.firstElementChild).toHaveStyle({ position: 'fixed' });
  });

  it('renders through a custom `as` element', () => {
    const { container } = wrap(<InternetStatus as="section" />);
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('auto-dismisses the connected confirmation', () => {
    vi.useFakeTimers();
    const { container } = wrap(<InternetStatus autoDismissMs={1_000} />);
    expect(screen.getByText('You are online!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(container).toBeEmptyDOMElement();

    // A real transition brings it back.
    act(() => setOnline(false));
    expect(screen.getByText('You are offline!')).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('<Online> / <Offline>', () => {
  it('render on the matching state only', () => {
    wrap(
      <>
        <Online>
          <span data-testid="on">connected</span>
        </Online>
        <Offline>
          <span data-testid="off">disconnected</span>
        </Offline>
      </>
    );
    expect(screen.getByTestId('on')).toBeInTheDocument();
    expect(screen.queryByTestId('off')).toBeNull();

    act(() => setOnline(false));
    expect(screen.queryByTestId('on')).toBeNull();
    expect(screen.getByTestId('off')).toBeInTheDocument();
  });
});
