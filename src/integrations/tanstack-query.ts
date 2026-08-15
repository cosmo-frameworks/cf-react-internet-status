import { createNetworkStore } from '../core/store';
import type { InternetStatusOptions } from '../core/types';

export interface OnlineManagerLike {
  setOnline(online: boolean): void;
}

/**
 * Feeds TanStack Query's `onlineManager` with probe-verified connectivity
 * instead of `navigator.onLine`, so pausing/resuming queries and mutations
 * reflects whether the network actually answers.
 *
 * Returns a teardown function.
 *
 * ```ts
 * import { onlineManager } from '@tanstack/react-query';
 * import { setupOnlineManager } from 'cf-react-internet-status';
 *
 * setupOnlineManager(onlineManager, { probe: { url: '/api/health' } });
 * ```
 *
 * A durable offline mutation queue is deliberately out of scope for this
 * package — TanStack Query's persisted mutations already solve it properly.
 */
export function setupOnlineManager(
  onlineManager: OnlineManagerLike,
  options?: InternetStatusOptions
): () => void {
  const store = createNetworkStore(options);

  const push = () => {
    const { status } = store.getSnapshot();
    // 'checking' and 'unknown' stay optimistic: pausing queries during the
    // very first probe would stall the app's initial load.
    onlineManager.setOnline(status !== 'offline');
  };

  const unsubscribe = store.subscribe(push);
  push();

  return () => {
    unsubscribe();
    store.destroy();
  };
}
