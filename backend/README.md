# Alt Text Audit API (Part 3 backend)

FastAPI service that crawls a page or sitemap, scores every `<img>` with the
shared rule-based scorer (`alt-text-scorer`, the Python package in
`packages/scorer/python`), and returns per-page and overall results. No AI,
no external API calls, nothing stored.

## Endpoints

- `GET /api/health` — liveness + scorer spec version.
- `POST /api/audit` — `{"url": "https://example.com", "max_pages": 5}`.
  - A page URL audits that one page.
  - A `sitemap.xml` URL (or any XML sitemap/sitemap-index response) audits up
    to `max_pages` pages listed in it (hard cap 20).
  - Response: per-image `category`, `reason`, `severity`, WCAG 1.1.1
    reference, template `suggested_fix`, and a `suggested_caption` slot that
    is always `null` until a captioning backend is wired into
    `app/captioning.py`.

## Design notes

- **Plain HTTP + BeautifulSoup only** — free and fast. Pages that return no
  `<img>` tags but plenty of `<script>` tags are flagged
  `possibly_js_rendered`; actually rendering them is the `fetch_rendered`
  extension point in `app/crawler.py`, deliberately unimplemented in the
  zero-cost MVP.
- **SSRF guard**: only http(s), and every URL (including each redirect hop)
  must resolve to a public address — loopback, private ranges, link-local,
  and cloud metadata addresses are refused.
- Lazy-loading attributes (`data-src`, `data-lazy-src`, `data-original`) are
  honoured when `src` is absent.

## Run locally

```bash
cd backend
pip install -r requirements-dev.txt   # includes ../packages/scorer/python
uvicorn app.main:app --reload         # http://localhost:8000/docs
pytest                                # 18 tests, network fully mocked
```

## Deploy (Render)

`render.yaml` at the repo root is a ready Render blueprint (free plan,
`rootDir: backend`, health check on `/api/health`). Point the dashboard's
`VITE_API_URL` at the service URL once deployed.
