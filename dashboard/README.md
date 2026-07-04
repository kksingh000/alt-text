# Alt Text Auditor — dashboard (Part 3 UI)

React + Vite + TypeScript + Tailwind v4 front end for the audit API. Enter a
page URL or `sitemap.xml`, get stat tiles, a filterable results table
(thumbnail, current alt, category badge, WCAG 1.1.1 reference, template fix),
and a client-side CSV export — no second crawl needed.

## Accessibility & design

- WCAG **AAA** text contrast (≥7:1) in both light and dark schemes.
- Category hues are validated for color-vision-deficiency separation
  (pairwise deutan/protan/tritan ΔE ≥ 13 in light mode) and never carry
  meaning alone — every badge and tile pairs the color with a text label.
- Stat-tile values wear ink, not category colors; the colored mark next to
  the label carries identity.
- Semantic table with caption and column headers doubles as the accessible
  data view; results are announced via live regions.
- The palette is shared with the extension popup (one product identity).

## Run locally

```bash
npm install                       # repo root
npm run dev -w @alt-text/dashboard   # Vite on :5173, proxies /api → :8000
# in another terminal:
cd backend && uvicorn app.main:app --reload
```

## Tests & build

```bash
npm run test -w @alt-text/dashboard    # CSV escaping unit tests
npm run build -w @alt-text/dashboard   # tsc --noEmit + vite build → dist/
```

## Deploy (Vercel)

Create a Vercel project with **Root Directory = `dashboard`** (framework:
Vite). Set the environment variable `VITE_API_URL` to the Render backend URL
(e.g. `https://alt-text-api.onrender.com`). No other config needed.
