# alt-text monorepo

Accessibility toolkit: rule-based alt text scorer (shared core), MV3 browser
extension, FastAPI audit backend, React dashboard. Zero paid APIs anywhere —
the only AI extension points are two stubs (see below).

## Commands

```bash
npm install                                   # all JS workspaces
npm test                                      # scorer + extension + dashboard unit tests
npm run test:py                               # Python scorer tests (needs pytest)
python3 -m pytest packages/scorer/python/tests backend/tests -q   # all Python tests
npm run check -w @alt-text/extension          # strict tsc (dashboard build includes its own)
npm run build:extension                       # → extension/dist/chrome (load unpacked)
npm run build:firefox -w @alt-text/extension  # → extension/dist/firefox
npm run test:e2e -w @alt-text/extension       # real Chromium via Playwright (builds first)
npm run package -w @alt-text/extension        # store-ready zips
npm run build -w @alt-text/dashboard          # tsc --noEmit && vite build
cd backend && pip install -r requirements-dev.txt && uvicorn app.main:app --reload
```

CI (.github/workflows/ci.yml) runs all of the above; the python job MUST
`pip install` with `working-directory: backend` — the requirements file
references the scorer by relative path, which pip resolves against CWD.

## Architecture invariants — read before changing the scorer

- **The rule data is the single source of truth**, not either language:
  `packages/scorer/spec/scorer.spec.json` holds every regex, word list,
  threshold, and per-category UI copy (label/shortLabel/description/fix/
  fallback). After editing it run `npm run sync-spec` to regenerate
  `ts/src/spec.data.ts` and `python/alt_text_scorer/spec_data.json`; sync
  tests in both suites fail if a copy is stale.
- **Both implementations must behave identically.** The contract is
  `packages/scorer/spec/fixtures.json` — every rule change needs a fixture
  case, and both test suites run all of them. Spec regexes must stay in the
  JS/Python common subset; the Python side compiles with `re.ASCII` and a
  `$`→`\Z` substitution to match JavaScript semantics (see `_compile` in
  scorer.py — don't remove it).
- UI copy for categories comes from the spec (`shortLabel`/`description`);
  never hardcode category labels in popup/dashboard components.
- The product palette lives ONLY in `packages/theme/palette.css` (imported by
  extension and dashboard). It is WCAG AAA (≥7:1) and validated for
  color-vision-deficiency separation — don't tweak hex values casually.

## Extension gotchas

- `content/scanner.ts` is pure DOM (no browser.* imports) so it runs under
  jsdom. Scoring always uses the *author's* alt: originals are persisted in
  `data-altguard-orig` so restore/rescoring survive content-script reloads.
- `content/index.ts` serializes scans (scanQueue) and cancels in-flight scans
  via a generation counter; all entry points await `ready`. Preserve these
  when touching enable/disable.
- The single future-AI hooks: `extension/src/content/captioning.ts`
  (`getCaptionForImage`) and `backend/app/captioning.py` (`suggest_caption`
  — any fetch there must go through the crawler's SSRF guard).
- Known limitation: content script runs top-frame only (no `all_frames`);
  iframe images are unscanned. Adding it requires frame-aware badge
  aggregation in the background worker.

## Backend gotchas

- Every outbound fetch must go through `crawler.fetch` (async SSRF guard on
  every redirect hop; concurrency bounded by semaphore in audit.py).
- API responses must stay in sync in three places: `backend/app/models.py`,
  the mapping in `backend/app/audit.py`, and `dashboard/src/types.ts`.
