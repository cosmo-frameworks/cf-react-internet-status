import { useMemo } from 'react';
import { isConnectionSupported } from '../core/connection';
import { useInternetStatusResolved } from './useInternetStatusContext';
import type { ConnectionInfo } from '../core/types';

export interface NetworkQuality extends ConnectionInfo {
  isSlow: boolean;
  /** `true` where the Network Information API is unavailable (Safari, Firefox). */
  isUnsupported: boolean;
}

const EMPTY: ConnectionInfo = {
  effectiveType: null,
  downlink: null,
  rtt: null,
  saveData: false,
  type: null,
};

/**
 * Network Information API data. Chromium-only in practice: elsewhere every
 * field is `null`/`false` and `isUnsupported` is `true`. It never throws.
 */
export function useNetworkQuality(): NetworkQuality {
  const { connection, isSlow } = useInternetStatusResolved();

  return useMemo(
    () => ({
      ...(connection ?? EMPTY),
      isSlow,
      isUnsupported: !isConnectionSupported(),
    }),
    [connection, isSlow]
  );
}
