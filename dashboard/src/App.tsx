import { useState } from 'react';
import { CATEGORY_ORDER, SPEC } from '@alt-text/scorer';
import { ApiError, runAudit } from './api';
import { AuditForm } from './components/AuditForm';
import { Badge } from './components/Badge';
import { ResultsTable } from './components/ResultsTable';
import { SummaryTiles } from './components/SummaryTiles';
import { auditToCsv, downloadCsv } from './csv';
import type { AltTextCategory, AuditResponse } from './types';

type ViewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; audit: AuditResponse };

// Filter labels come from the shared spec so every surface says the same thing.
const FILTERS: Array<{ key: AltTextCategory | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'All' },
  ...CATEGORY_ORDER.map((key) => ({ key, label: SPEC.categories[key].shortLabel })),
];

export function App() {
  const [state, setState] = useState<ViewState>({ status: 'idle' });
  const [filter, setFilter] = useState<AltTextCategory | 'ALL'>('ALL');

  async function handleSubmit(url: string, maxPages: number) {
    setState({ status: 'loading' });
    setFilter('ALL');
    try {
      setState({ status: 'done', audit: await runAudit(url, maxPages) });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof ApiError ? error.message : 'Something went wrong running the audit.',
      });
    }
  }

  function exportCsv() {
    if (state.status !== 'done') return;
    const host = new URL(state.audit.requested_url).hostname.replaceAll('.', '-');
    downloadCsv(`alt-text-audit-${host}.csv`, auditToCsv(state.audit));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <header className="border-b-2 border-ink py-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em]">
          Alt Text <span className="text-accent">Auditor</span>
        </p>
        <h1 className="mt-2 text-2xl font-bold">Image alt text audit</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Crawls a page or sitemap and scores every image against WCAG 1.1.1 with rule-based checks
          — no AI, nothing stored.
        </p>
      </header>

      <section className="py-6" aria-label="Run an audit">
        <AuditForm loading={state.status === 'loading'} onSubmit={(u, m) => void handleSubmit(u, m)} />
      </section>

      {state.status === 'loading' && (
        <p role="status" className="py-4 font-semibold">
          Crawling and scoring images…
        </p>
      )}

      {state.status === 'error' && (
        <p role="alert" className="rounded-md border-2 border-missing px-4 py-3 font-semibold text-missing">
          {state.message}
        </p>
      )}

      {state.status === 'done' && (
        <div className="flex flex-col gap-6">
          <div role="status" className="sr-only">
            Audit complete: {state.audit.total_images} images scanned.
          </div>

          <SummaryTiles totals={state.audit.totals} totalImages={state.audit.total_images} />

          <PageNotes audit={state.audit} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={
                    filter === key
                      ? 'rounded-full border-2 border-ink bg-ink px-3 py-1 text-sm font-semibold text-bg'
                      : 'rounded-full border border-border bg-surface px-3 py-1 text-sm font-semibold'
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-md border-2 border-ink px-4 py-1.5 text-sm font-semibold"
            >
              Export CSV
            </button>
          </div>

          <ResultsTable audit={state.audit} filter={filter} />
        </div>
      )}

      {state.status === 'idle' && <ExampleLegend />}
    </div>
  );
}

function PageNotes({ audit }: { audit: AuditResponse }) {
  const failed = audit.pages.filter((page) => !page.fetched);
  const jsRendered = audit.pages.filter((page) => page.possibly_js_rendered);
  if (failed.length === 0 && jsRendered.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm text-muted">
      {failed.map((page) => (
        <li key={page.url}>
          ⚠ Could not fetch <span className="font-mono">{page.url}</span>
          {page.error ? ` — ${page.error}` : ''}
        </li>
      ))}
      {jsRendered.map((page) => (
        <li key={page.url}>
          ⚠ <span className="font-mono">{page.url}</span> has no images in its HTML and looks
          JavaScript-rendered — a browser-based crawl would be needed to see its images.
        </li>
      ))}
    </ul>
  );
}

function ExampleLegend() {
  return (
    <section aria-label="Categories" className="py-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
        What the categories mean
      </h2>
      <ul className="flex flex-col gap-2.5">
        {CATEGORY_ORDER.map((key) => (
          <li key={key} className="flex items-baseline gap-3">
            <Badge category={key} />
            <span className="text-muted">{SPEC.categories[key].description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
