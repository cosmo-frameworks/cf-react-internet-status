import { useState } from 'react';
import {
  InternetStatus,
  InternetStatusProvider,
  Offline,
  Online,
  useInternetStatusContext,
  useNetworkQuality,
  useOfflineDuration,
  useOnReconnect,
} from 'cf-react-internet-status';

const box: React.CSSProperties = {
  border: '1px solid #d0d0d0',
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};

function Dashboard() {
  const state = useInternetStatusContext();
  const quality = useNetworkQuality();
  const offlineFor = useOfflineDuration();
  const [log, setLog] = useState<string[]>([]);

  useOnReconnect(({ offlineDurationMs }) => {
    setLog((l) => [
      `reconnected after ${Math.round(offlineDurationMs / 1000)}s`,
      ...l,
    ]);
  });

  return (
    <>
      <div style={box}>
        <h2>State</h2>
        <table>
          <tbody>
            {(
              [
                ['status', state.status],
                ['isOnline (navigator.onLine)', String(state.isOnline)],
                ['isInternetReachable', String(state.isInternetReachable)],
                ['isChecking', String(state.isChecking)],
                ['failureCount', String(state.failureCount)],
                [
                  'lastCheckedAt',
                  state.lastCheckedAt
                    ? new Date(state.lastCheckedAt).toLocaleTimeString()
                    : '—',
                ],
                ['offline for', offlineFor ? `${offlineFor} ms` : '—'],
              ] as const
            ).map(([label, value]) => (
              <tr key={label}>
                <td style={{ paddingRight: 16 }}>{label}</td>
                <td>
                  <code>{value}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => void state.recheck()} style={{ marginTop: 12 }}>
          recheck()
        </button>
      </div>

      <div style={box}>
        <h2>Network quality</h2>
        {quality.isUnsupported ? (
          <p>
            <em>
              Network Information API unavailable in this browser (Chromium
              only).
            </em>
          </p>
        ) : (
          <p>
            <code>
              {quality.effectiveType} · {quality.downlink} Mbps ·{' '}
              {quality.rtt} ms · slow: {String(quality.isSlow)}
            </code>
          </p>
        )}
      </div>

      <div style={box}>
        <h2>Components</h2>
        <InternetStatus />
        <Online>
          <p>✅ &lt;Online&gt; renders while connected.</p>
        </Online>
        <Offline>
          <p>⚠️ &lt;Offline&gt; renders while disconnected.</p>
        </Offline>
      </div>

      <div style={box}>
        <h2>useOnReconnect log</h2>
        {log.length === 0 ? <p>—</p> : <ul>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      </div>

      <InternetStatus hideWhenOnline variant="banner" position="bottom" />
    </>
  );
}

export function App() {
  const [probeUrl, setProbeUrl] = useState('/favicon.ico');
  const [applied, setApplied] = useState('/favicon.ico');

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 720,
        margin: '32px auto',
        padding: '0 16px',
      }}
    >
      <h1>cf-react-internet-status</h1>
      <p>
        Toggle DevTools&apos; offline mode, or block the probe URL under
        Network → &ldquo;Block request URL&rdquo; while staying online — that is
        the captive-portal case <code>navigator.onLine</code> cannot detect.
      </p>

      <div style={box}>
        <label>
          Probe URL{' '}
          <input
            value={probeUrl}
            onChange={(e) => setProbeUrl(e.target.value)}
            style={{ width: 320 }}
          />
        </label>{' '}
        <button onClick={() => setApplied(probeUrl)}>Apply</button>
      </div>

      {/* `key` remounts the provider so new probe options take effect. */}
      <InternetStatusProvider
        key={applied}
        probe={{ url: applied, intervalMs: 5_000 }}
      >
        <Dashboard />
      </InternetStatusProvider>
    </main>
  );
}
