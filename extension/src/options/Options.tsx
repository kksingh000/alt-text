import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import { clearDisabledHosts, DISABLED_HOSTS_KEY, getDisabledHosts, setHostEnabled } from '../shared/settings';

export function Options() {
  const [hosts, setHosts] = useState<string[] | null>(null);

  useEffect(() => {
    const refresh = () => void getDisabledHosts().then((list) => setHosts([...list].sort()));
    refresh();
    const listener = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && DISABLED_HOSTS_KEY in changes) refresh();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <>
      <header>
        <h1>
          Alt Text <span className="brand-accent">Guardian</span>
        </h1>
        <p className="subtitle">Settings</p>
      </header>
      <main>
        <section aria-labelledby="disabled-heading">
          <h2 id="disabled-heading">Sites where scanning is off</h2>
          <p className="muted">
            Scanning is on for every site by default. Sites you switch off from the toolbar popup
            are listed here; re-enabling applies immediately to any open tabs.
          </p>

          {hosts === null && (
            <p className="muted" role="status">
              Loading…
            </p>
          )}

          {hosts !== null && hosts.length === 0 && (
            <p className="empty" role="status">
              No sites are switched off — scanning is on everywhere.
            </p>
          )}

          {hosts !== null && hosts.length > 0 && (
            <>
              <ul className="host-list">
                {hosts.map((host) => (
                  <li key={host}>
                    <span className="host">{host}</span>
                    <button type="button" onClick={() => void setHostEnabled(host, true)}>
                      Enable
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="enable-all" onClick={() => void clearDisabledHosts()}>
                Enable scanning everywhere
              </button>
            </>
          )}
        </section>

        <section aria-labelledby="how-heading">
          <h2 id="how-heading">How it works</h2>
          <p className="muted">
            Every image is checked with rule-based pattern matching, entirely on your device.
            Images with missing or placeholder alt text get a meaningful screen reader
            announcement instead of silence or a filename. Nothing is sent anywhere.
          </p>
        </section>
      </main>
    </>
  );
}
