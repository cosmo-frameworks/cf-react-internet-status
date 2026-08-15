import type { ReactNode } from 'react';
import { useInternetStatusResolved } from '../hooks/useInternetStatusContext';

export interface ConditionalProps {
  children?: ReactNode;
  /**
   * Use probe-verified reachability rather than just `navigator.onLine`.
   * Defaults to `true`.
   */
  useReachability?: boolean;
}

/** Renders its children only while connected. */
export function Online({ children, useReachability = true }: ConditionalProps) {
  const state = useInternetStatusResolved();
  const connected = useReachability
    ? state.status === 'online'
    : state.isOnline;
  return connected ? <>{children}</> : null;
}

/** Renders its children only while disconnected. */
export function Offline({
  children,
  useReachability = true,
}: ConditionalProps) {
  const state = useInternetStatusResolved();
  const disconnected = useReachability
    ? state.status === 'offline'
    : !state.isOnline;
  return disconnected ? <>{children}</> : null;
}
