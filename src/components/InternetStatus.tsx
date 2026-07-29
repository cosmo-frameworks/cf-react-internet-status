import { createElement, useEffect, useState } from 'react';
import type { CSSProperties, ElementType, ReactNode } from 'react';
import { useInternetStatusResolved } from '../hooks/useInternetStatusContext';
import type { UseInternetStatusResult } from '../hooks/useInternetStatus';
import type { NetworkStatus } from '../core/types';

export interface InternetStatusProps {
  className?: string;
  style?: CSSProperties;
  /** Wrapper element or component. Defaults to `'div'`. */
  as?: ElementType;

  /** Content per state. Omit for the built-in defaults. */
  online?: ReactNode;
  offline?: ReactNode;
  checking?: ReactNode;
  unknown?: ReactNode;

  /**
   * Render-prop receiving the full state plus `recheck`. Takes precedence over
   * the per-state props and renders without the wrapper.
   */
  children?: (state: UseInternetStatusResult) => ReactNode;

  /** Render nothing while connected. */
  hideWhenOnline?: boolean;
  /**
   * Treat probe-verified unreachability as offline, even when
   * `navigator.onLine` is `true`. Set `false` for v1 semantics.
   */
  useReachability?: boolean;
  /** Hide the *connected* confirmation after N ms. Offline never auto-hides. */
  autoDismissMs?: number;

  variant?: 'inline' | 'banner' | 'toast';
  position?: 'top' | 'bottom';
  /** Emit no inline styles at all — bring your own CSS. */
  unstyled?: boolean;

  role?: string;
  'aria-live'?: 'off' | 'polite' | 'assertive';
}

const defaults: Record<NetworkStatus, ReactNode> = {
  online: <p style={{ color: 'green', margin: 0 }}>You are online!</p>,
  offline: <p style={{ color: 'red', margin: 0 }}>You are offline!</p>,
  checking: <p style={{ color: 'gray', margin: 0 }}>Checking connection…</p>,
  unknown: <p style={{ color: 'gray', margin: 0 }}>Connection status unknown</p>,
};

function positionStyles(
  variant: 'inline' | 'banner' | 'toast',
  position: 'top' | 'bottom'
): CSSProperties {
  if (variant === 'inline') return {};
  const edge = position === 'top' ? { top: 0 } : { bottom: 0 };
  if (variant === 'banner') {
    return { position: 'fixed', left: 0, right: 0, ...edge, zIndex: 9999 };
  }
  return { position: 'fixed', right: 16, ...edge, zIndex: 9999 };
}

export function InternetStatus({
  className,
  style,
  as: Wrapper = 'div',
  online,
  offline,
  checking,
  unknown,
  children,
  hideWhenOnline = false,
  useReachability = true,
  autoDismissMs,
  variant = 'inline',
  position = 'top',
  unstyled = false,
  role,
  'aria-live': ariaLive,
}: InternetStatusProps) {
  const state = useInternetStatusResolved();

  const status: NetworkStatus = useReachability
    ? state.status
    : state.isOnline
      ? 'online'
      : 'offline';

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (autoDismissMs === undefined || status === 'offline') {
      setDismissed(false);
      return;
    }
    setDismissed(false);
    const id = setTimeout(() => setDismissed(true), autoDismissMs);
    return () => clearTimeout(id);
  }, [autoDismissMs, status]);

  if (children) return <>{children(state)}</>;

  if (hideWhenOnline && status === 'online') return null;
  if (dismissed) return null;

  const content =
    ({ online, offline, checking, unknown } as Record<
      NetworkStatus,
      ReactNode
    >)[status] ?? defaults[status];

  // Offline is an interruption worth announcing immediately; everything else
  // is a status update that should wait its turn.
  const resolvedRole = role ?? (status === 'offline' ? 'alert' : 'status');
  const resolvedAriaLive =
    ariaLive ?? (status === 'offline' ? 'assertive' : 'polite');

  const resolvedStyle: CSSProperties | undefined = unstyled
    ? style
    : { ...positionStyles(variant, position), ...style };

  return createElement(
    Wrapper,
    {
      className,
      style: resolvedStyle,
      role: resolvedRole,
      'aria-live': resolvedAriaLive,
    },
    content
  );
}

export default InternetStatus;
