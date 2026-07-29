import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetDefaultStore } from '../src/core/store';

/**
 * jsdom's `navigator.onLine` is a read-only getter, and dispatching an
 * online/offline event does not change it. Tests need both to move together.
 */
export function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    value,
    configurable: true,
    writable: true,
  });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

/** Change `navigator.onLine` WITHOUT firing an event (missed-event scenarios). */
export function setOnlineSilently(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    value,
    configurable: true,
    writable: true,
  });
}

export function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'visibilityState', {
    value: hidden ? 'hidden' : 'visible',
    configurable: true,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** A resolved, reachable-looking response. */
export const okResponse = () =>
  Promise.resolve({ type: 'basic', ok: true, status: 200 } as Response);

beforeEach(() => {
  setOnlineSilently(true);
  Object.defineProperty(document, 'visibilityState', {
    value: 'visible',
    configurable: true,
  });
  // Probing is on by default, so an unstubbed global fetch would fire real
  // requests from any test touching the shared store.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => okResponse())
  );
});

afterEach(() => {
  resetDefaultStore();
  vi.unstubAllGlobals();
});
