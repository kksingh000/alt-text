import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import type { AltTextCategory } from '@alt-text/scorer';
import type { ContentRequest, PageReport } from '../shared/messages';

const CATEGORY_ROWS: Array<{ key: AltTextCategory; label: string; hint: string }> = [
  {
    key: 'MISSING',
    label: 'Missing',
    hint: 'No alt attribute, or an empty alt on a content image',
  },
  {
    key: 'GENERIC',
    label: 'Generic',
    hint: 'Filename-style or placeholder alt text (img_1234, "photo", …)',
  },
  {
    key: 'DECORATIVE_UNMARKED',
    label: 'Unmarked decorative',
    hint: 'Looks decorative but is not hidden from screen readers',
  },
  {
    key: 'GOOD',
    label: 'Good',
    hint: 'Descriptive alt text, or correctly marked decorative',
  },
];

type ViewState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; tabId: number; report: PageReport };

async function sendToTab(tabId: number, message: ContentRequest): Promise<PageReport> {
  return (await browser.tabs.sendMessage(tabId, message)) as PageReport;
}

export function App() {
  const [state, setState] = useState<ViewState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id === undefined) {
          setState({ status: 'unavailable' });
          return;
        }
        const report = await sendToTab(tab.id, { type: 'GET_REPORT' });
        setState({ status: 'ready', tabId: tab.id, report });
      } catch {
        // No content script here: browser UI pages, the extension store, PDFs…
        setState({ status: 'unavailable' });
      }
    })();
  }, []);

  async function toggle() {
    if (state.status !== 'ready' || busy) return;
    setBusy(true);
    try {
      const report = await sendToTab(state.tabId, {
        type: 'SET_ENABLED',
        enabled: !state.report.enabled,
      });
      setState({ status: 'ready', tabId: state.tabId, report });
    } catch {
      setState({ status: 'unavailable' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header>
        <h1>
          Alt Text <span className="brand-accent">Guardian</span>
        </h1>
      </header>
      <main>
        {state.status === 'loading' && (
          <p className="muted" role="status">
            Reading page…
          </p>
        )}
        {state.status === 'unavailable' && (
          <p className="muted">
            This page can&rsquo;t be scanned. Browser and extension-store pages don&rsquo;t allow
            extensions to run.
          </p>
        )}
        {state.status === 'ready' && (
          <ReportView report={state.report} busy={busy} onToggle={() => void toggle()} />
        )}
      </main>
      <footer>Rule-based checks only — nothing leaves this page.</footer>
    </>
  );
}

function ReportView({
  report,
  busy,
  onToggle,
}: {
  report: PageReport;
  busy: boolean;
  onToggle: () => void;
}) {
  const host = report.host || 'this page';
  const issues = report.counts
    ? report.counts.MISSING + report.counts.GENERIC + report.counts.DECORATIVE_UNMARKED
    : 0;

  return (
    <>
      <div className="site-row">
        <span className="host" title={host}>
          {host}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={report.enabled}
          aria-label={`Scan ${host}`}
          className="switch"
          disabled={busy}
          onClick={onToggle}
        >
          <span className="knob" aria-hidden="true" />
        </button>
      </div>

      {!report.enabled && <p className="muted">Scanning is off for this site.</p>}

      {report.enabled && report.counts === null && (
        <p className="muted" role="status">
          Scanning…
        </p>
      )}

      {report.enabled && report.counts !== null && (
        <>
          <p className={issues > 0 ? 'status attention' : 'status ok'} role="status">
            {issues === 0
              ? 'No alt text issues found'
              : `${issues} ${issues === 1 ? 'image needs' : 'images need'} attention`}
          </p>
          <ul className="rows">
            {CATEGORY_ROWS.map(({ key, label, hint }) => (
              <li key={key}>
                <span className={`dot ${key.toLowerCase()}`} aria-hidden="true" />
                <span className="label" title={hint}>
                  {label}
                </span>
                <span className={`count ${key.toLowerCase()}`}>{report.counts?.[key] ?? 0}</span>
              </li>
            ))}
          </ul>
          <p className="total">
            {report.total} {report.total === 1 ? 'image' : 'images'} scanned
          </p>
        </>
      )}
    </>
  );
}
