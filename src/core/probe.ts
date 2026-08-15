export interface ResolvedProbeConfig {
  method: 'HEAD' | 'GET';
  mode: RequestMode;
  timeoutMs: number;
  cacheBust: boolean;
  fetch: typeof fetch;
}

function withCacheBust(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cfis=${Date.now().toString(36)}`;
}

/**
 * Fires a single reachability request.
 *
 * Resolves `true` if the request came back at all, `false` on timeout or any
 * network-level failure. Never throws.
 */
export async function probeOnce(
  url: string,
  config: ResolvedProbeConfig,
  outerSignal?: AbortSignal
): Promise<boolean> {
  if (outerSignal?.aborted) return false;

  const controller = new AbortController();
  const onOuterAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await config.fetch(
      config.cacheBust ? withCacheBust(url) : url,
      {
        method: config.method,
        mode: config.mode,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      }
    );

    // With `mode: 'no-cors'` the response is opaque: status is always 0 and
    // unreadable. Resolution itself is the signal — DNS resolved, the socket
    // connected, bytes came back.
    if (response.type === 'opaque') return true;

    return response.ok || (response.status >= 200 && response.status < 400);
  } catch {
    // AbortError (timeout) or TypeError (network/DNS/CORS failure).
    return false;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', onOuterAbort);
  }
}

export async function probeAll(
  urls: string[],
  strategy: 'any' | 'all',
  config: ResolvedProbeConfig,
  outerSignal?: AbortSignal
): Promise<boolean> {
  if (urls.length === 0) return true;
  const results = await Promise.all(
    urls.map((url) => probeOnce(url, config, outerSignal))
  );
  return strategy === 'all' ? results.every(Boolean) : results.some(Boolean);
}
