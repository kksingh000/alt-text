# Alt Text Guardian — browser extension (Part 2)

Manifest V3 extension that scans every `<img>` with the shared rule-based
scorer (`@alt-text/scorer`, zero network calls) and makes bad alt text
survivable for screen reader users:

- **MISSING** → alt becomes *"Image, no description available"* — an honest
  announcement instead of silence or a filename.
- **GENERIC** → alt becomes *"Image, description may be unreliable: img_1234"*
  — warns the user but keeps whatever hint the original text carried.
- **DECORATIVE_UNMARKED** → counted and reported, but never rewritten: adding
  `role="presentation"` ourselves would change page semantics.
- The page author's original alt is always tracked and restored exactly
  (including *absent* attributes) when scanning is toggled off.

SPA-safe: a debounced `MutationObserver` re-scans on DOM changes, scoring is
always based on the author's original alt (never our own injection, so no
feedback loops), and re-scans are idempotent.

## Build & load

```bash
npm install            # at the repo root
npm run build:extension
```

- **Chrome / Edge**: `chrome://extensions` → enable Developer mode → *Load
  unpacked* → select `extension/dist/chrome`.
- **Firefox**: `npm run build:firefox -w @alt-text/extension`, then
  `about:debugging` → *This Firefox* → *Load Temporary Add-on* → select
  `extension/dist/firefox/manifest.json`. The port is purely the config
  change in `build.mjs` (event-page background + gecko id) — all code is
  shared via `webextension-polyfill`.

## Architecture

```
src/
├── content/
│   ├── index.ts       # wiring: settings, MutationObserver, messaging (vanilla TS)
│   ├── scanner.ts     # pure DOM scan/inject/restore logic — unit-tested under jsdom
│   └── captioning.ts  # getCaptionForImage() stub → null. THE extension point for
│                      #   a future free-tier vision API; nothing else changes.
├── background/index.ts# per-tab badge with the count of flagged images
├── popup/             # React: per-site toggle + category breakdown (WCAG AAA contrast)
├── options/           # React: manage the disabled-site list; changes apply live
│                      #   to open tabs via storage.onChanged
└── shared/            # typed message protocol + per-site settings + shared theme
```

Message flow:

- content → background: `REPORT` after every scan → badge count for the tab
  (MISSING + GENERIC + DECORATIVE_UNMARKED).
- popup → content: `GET_REPORT` on open; `SET_ENABLED` on toggle. The content
  script is the single writer of both the DOM and the per-site setting.

Sites are **on by default**; the toggle stores an opt-out list of hostnames in
`storage.local`, so no browsing data ever needs syncing or leaving the machine.
The options page (right-click the icon → Options) lists every switched-off
site with one-click re-enable; because content scripts watch
`storage.onChanged`, enabling/disabling applies to already-open tabs
immediately — injected alts are restored or re-applied live.

## Packaging for the stores

```bash
npm run package -w @alt-text/extension
# → extension/dist/alt-text-guardian-chrome-v0.1.0.zip   (Chrome Web Store / Edge)
# → extension/dist/alt-text-guardian-firefox-v0.1.0.zip  (Firefox Add-ons)
```

## Tests

```bash
npm run test -w @alt-text/extension    # scanner unit tests (vitest + jsdom)
npm run check -w @alt-text/extension   # strict TypeScript
npm run test:e2e -w @alt-text/extension# builds, then loads the real extension
                                       #   into headless Chromium via Playwright
                                       #   and asserts DOM effects on a fixture page
```

## Icons

`public/icons/*.png` are generated — `npm run icons -w @alt-text/extension`
re-renders them from geometry in `tools/gen-icons.mjs` (self-contained PNG
encoder, no image tooling required).
