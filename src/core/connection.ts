import { DEFAULT_SLOW_THRESHOLDS } from './constants';
import type {
  ConnectionInfo,
  EffectiveConnectionType,
  SlowThresholds,
} from './types';

/**
 * The Network Information API is not in every `lib.dom.d.ts`, so it is
 * declared locally rather than reached for via `any`. Chromium-only in
 * practice — Safari and Firefox never expose it.
 */
interface NetworkInformationLike extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  type?: string;
}

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
};

const EFFECTIVE_TYPES: EffectiveConnectionType[] = [
  'slow-2g',
  '2g',
  '3g',
  '4g',
];

function getConnection(): NetworkInformationLike | null {
  if (typeof navigator !== 'object' || navigator === null) return null;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

export function isConnectionSupported(): boolean {
  return getConnection() !== null;
}

export function readConnection(): ConnectionInfo | null {
  const c = getConnection();
  if (!c) return null;

  const effectiveType =
    typeof c.effectiveType === 'string' &&
    (EFFECTIVE_TYPES as string[]).includes(c.effectiveType)
      ? (c.effectiveType as EffectiveConnectionType)
      : null;

  return {
    effectiveType,
    downlink: typeof c.downlink === 'number' ? c.downlink : null,
    rtt: typeof c.rtt === 'number' ? c.rtt : null,
    saveData: c.saveData === true,
    type: typeof c.type === 'string' ? c.type : null,
  };
}

/** Subscribes to the connection's `change` event. Returns an unsubscribe fn. */
export function subscribeConnection(listener: () => void): () => void {
  const c = getConnection();
  if (!c || typeof c.addEventListener !== 'function') return () => undefined;
  c.addEventListener('change', listener);
  return () => c.removeEventListener('change', listener);
}

export function isSlowConnection(
  info: ConnectionInfo | null,
  thresholds?: SlowThresholds
): boolean {
  if (!info) return false;

  const effectiveTypes =
    thresholds?.effectiveTypes ?? DEFAULT_SLOW_THRESHOLDS.effectiveTypes;
  const maxDownlink =
    thresholds?.maxDownlink ?? DEFAULT_SLOW_THRESHOLDS.maxDownlink;
  const maxRtt = thresholds?.maxRtt ?? DEFAULT_SLOW_THRESHOLDS.maxRtt;

  if (info.saveData) return true;
  if (info.effectiveType && effectiveTypes.includes(info.effectiveType)) {
    return true;
  }
  if (info.downlink !== null && info.downlink < maxDownlink) return true;
  if (info.rtt !== null && info.rtt > maxRtt) return true;
  return false;
}
