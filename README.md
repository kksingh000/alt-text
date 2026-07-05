# alt-text — accessibility toolkit for missing & broken image descriptions

[![CI](https://github.com/kksingh000/alt-text/actions/workflows/ci.yml/badge.svg)](https://github.com/kksingh000/alt-text/actions/workflows/ci.yml)

A zero-cost, rule-based toolkit that finds images whose alt text is missing,
generic, or noise for screen reader users. No paid AI APIs anywhere; clean
extension points exist for adding a free-tier vision model later.

## Three parts

| Part | What | Stack | Status |
|------|------|-------|--------|
| 1. Shared scorer | Classifies alt text as `MISSING` / `GENERIC` / `DECORATIVE_UNMARKED` / `GOOD` with pure pattern matching | TypeScript + Python, driven by one canonical JSON rule spec | ✅ implemented |
| 2. Browser extension | Scans pages (incl. SPAs via MutationObserver), announces meaningful fallbacks to screen readers, popup with per-site toggle and counts | Manifest V3, vanilla TS content script, React popup, webextension-polyfill | ✅ implemented |
| 3. Audit dashboard | Crawl a URL or sitemap server-side, score every image, results table with WCAG 1.1.1 references and template fixes, CSV export | FastAPI (Render) + React/Vite/Tailwind (Vercel) | ✅ implemented |

## Repository layout

```
alt-text/
├── packages/
│   └── scorer/                    # Part 1 — the shared core (implemented)
│       ├── spec/
│       │   ├── scorer.spec.json   # SINGLE SOURCE OF TRUTH: regexes, generic words,
│       │   │                      #   thresholds, per-category WCAG refs & fix templates
│       │   └── fixtures.json      # golden test cases BOTH implementations must pass
│       ├── scripts/sync-spec.mjs  # regenerates the vendored per-language spec copies
│       ├── ts/                    # TypeScript impl → consumed by extension + dashboard
│       └── python/                # Python impl → consumed by the FastAPI backend
│
├── extension/                     # Part 2 — Manifest V3 (implemented)
│   ├── build.mjs                  # esbuild → dist/chrome and dist/firefox (the Firefox
│   │                              #   port is exactly this config difference)
│   ├── src/
│   │   ├── content/               # vanilla TS: scan <img> on load + MutationObserver,
│   │   │   │                      #   inject screen-reader fallbacks for MISSING/GENERIC
│   │   │   └── captioning.ts      # getCaptionForImage(img) stub → returns null (hook for
│   │   │                          #   a free vision API later; no refactor needed)
│   │   ├── popup/                 # React: per-site toggle, category counts (WCAG AAA)
│   │   ├── options/               # React: disabled-site list, live sync to open tabs
│   │   ├── background/            # service worker: per-tab issue-count badge
│   │   └── shared/                # typed messages + per-site settings + theme
│   ├── tools/gen-icons.mjs        # regenerates icons (self-contained PNG encoder)
│   └── tests/                     # scanner unit tests (jsdom) + Playwright e2e
│
├── backend/                       # Part 3 API — FastAPI, deployed on Render (implemented)
│   ├── app/                       # crawler (httpx + BeautifulSoup, SSRF-guarded,
│   │   │                          #   sitemap + sitemap-index support, JS-rendered
│   │   │                          #   pages detected and flagged), audit endpoints
│   │   └── captioning.py          # suggest_caption(src) stub → returns None
│   └── tests/                     # 18 pytest tests, network fully mocked
│
├── dashboard/                     # Part 3 UI — React + Vite + Tailwind v4, on Vercel
│   └── src/                       # stat tiles, filterable results table with WCAG refs,
│                                  #   client-side CSV export; WCAG AAA contrast and
│                                  #   CVD-validated category palette (implemented)
│
└── render.yaml                    # Render blueprint for the backend (free plan)
```

## Part 1 — the shared scorer

Neither language port is "the" source of truth; the **rule data** is. All
regexes, generic-word lists, size thresholds, WCAG references, and suggested-fix
templates live in [`packages/scorer/spec/scorer.spec.json`](packages/scorer/spec/scorer.spec.json)
(written in the regex subset common to JavaScript and Python). Each language has
a thin ~150-line engine plus a generated copy of that data, and both test suites
run the same [golden fixtures](packages/scorer/spec/fixtures.json), so the two
implementations cannot drift silently — a sync test fails if a vendored copy is
stale.

To change a rule:

1. Edit `packages/scorer/spec/scorer.spec.json`
2. Run `npm run sync-spec`
3. Add a case to `packages/scorer/spec/fixtures.json`
4. Run both test suites (below)

See [`packages/scorer/README.md`](packages/scorer/README.md) for the category
semantics, evaluation order, and API of both implementations.

## Development

```bash
# TypeScript
npm install
npm test                 # vitest: golden fixtures + scorer/extension unit tests
npm run -w @alt-text/scorer build

# Extension
npm run build:extension                  # → extension/dist/chrome (load unpacked)
npm run build:firefox -w @alt-text/extension
npm run test:e2e -w @alt-text/extension  # loads the real extension in Chromium
npm run package -w @alt-text/extension   # store-ready zips for Chrome + Firefox

# Python (3.10+)
python3 -m pip install pytest
npm run test:py          # same golden fixtures + unit tests

# Backend + dashboard (Part 3)
cd backend && pip install -r requirements-dev.txt && pytest && uvicorn app.main:app --reload
npm run dev -w @alt-text/dashboard   # Vite dev server, proxies /api → :8000

# After editing the canonical spec
npm run sync-spec
```

## Cost policy

Everything ships with **zero external API calls**. The scorer is pure pattern
matching (the same approach axe-core and WAVE use). If free-tier vision
captioning is added later (e.g. Gemini free tier), it plugs into exactly two
stubs — `extension/src/content/captioning.ts` and `backend/app/captioning.py` —
which currently return `null`/`None`.
