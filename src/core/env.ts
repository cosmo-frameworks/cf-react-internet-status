export const canUseDOM = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.addEventListener === 'function';

export const canUseDocument = (): boolean =>
  typeof document !== 'undefined' &&
  typeof document.addEventListener === 'function';

/**
 * Reads `navigator.onLine` defensively.
 *
 * A `typeof navigator !== 'undefined'` check is NOT enough: Node 21+ defines
 * `globalThis.navigator` (with `userAgent`, `language`, ...) but *without*
 * `onLine`, so that check passes on the server and yields `undefined`.
 * We probe the property itself and fall back to an optimistic `true` so SSR
 * never renders an offline state into the markup.
 */
export const readOnLine = (): boolean =>
  typeof navigator === 'object' &&
  navigator !== null &&
  typeof navigator.onLine === 'boolean'
    ? navigator.onLine
    : true;

export const isHidden = (): boolean =>
  canUseDocument() && document.visibilityState === 'hidden';
