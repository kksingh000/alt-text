# @alt-text/scorer & alt-text-scorer

Rule-based alt text quality scorer — the shared core of the alt-text toolkit.
Pure pattern matching: no I/O, no network, no AI. Two thin implementations
(TypeScript for the extension/dashboard, Python for the FastAPI backend) driven
by one canonical rule spec and verified against one golden fixture file.

## Categories

| Category | Meaning | Severity |
|----------|---------|----------|
| `MISSING` | No `alt` attribute, `alt=""` on a content image, or whitespace-only alt | error |
| `GENERIC` | Filename-shaped alt (`img_1234`, `DSC_0042`, `Screenshot 2024-…`, hashes, UUIDs), a lone generic word (`image`, `photo`, `icon`, `logo`, …), alt identical to the file name, or a single ASCII word under 4 characters | warning |
| `DECORATIVE_UNMARKED` | Image looks decorative (any dimension ≤ 3px, both dimensions < 20px, or a spacer/divider/bullet-style filename) but isn't marked `alt=""` / `role="presentation"` / `aria-hidden="true"` | warning |
| `GOOD` | Passes all checks, or is correctly marked decorative | pass |

Every result also carries the WCAG 1.1.1 reference, a human-readable label, a
suggested-fix template, and (for `MISSING`/`GENERIC`) a screen-reader fallback
string — all sourced from the spec, so the extension and dashboard render
identical guidance.

## Evaluation order

1. `role="presentation"`/`role="none"` or `aria-hidden="true"` → `GOOD`
   (`explicitly-marked-decorative`). The author opted out; we respect it.
2. If the image *looks* decorative (tiny dimensions or decorative filename):
   - `alt=""` → `GOOD` (`decorative-correctly-marked`)
   - alt missing/whitespace/generic → `DECORATIVE_UNMARKED`
   - genuinely descriptive alt → falls through to `GOOD`. A 16×16 icon
     labelled "Search" is useful, not noise, so the tiny-image heuristic
     only fires when the alt was already bad.
3. Otherwise the alt text itself decides: `MISSING` → `GENERIC` checks
   (generic word → pattern list → filename match → short single word) → `GOOD`.

Each result includes a stable `reason` code (e.g. `no-alt-attribute`,
`generic-pattern`, `tiny-image-unmarked`) so UIs can explain *why*.

### Deliberate deviations from naive pattern lists

- `^screenshot` alone would flag *"Screenshot of the billing settings page"*,
  which is perfectly good alt text. Only default screenshot **filenames**
  (`Screenshot 2024-01-15 at 10.33.12`, `Screenshot from …`, bare
  `screenshot`) are flagged.
- `alt=""` is valid decorative markup, so it's only `MISSING` when the image
  does **not** look decorative — on a content-sized image it usually hides
  meaning rather than marking decoration.
- The "single word shorter than 4 chars" rule only applies to ASCII, so CJK
  alt text (e.g. 海辺の夕日) isn't punished for being compact.

## Keeping the two implementations in sync

```
spec/scorer.spec.json      ← canonical rule data (EDIT THIS)
        │  node packages/scorer/scripts/sync-spec.mjs
        ├──→ ts/src/spec.data.ts                    (generated)
        └──→ python/alt_text_scorer/spec_data.json  (generated)

spec/fixtures.json         ← golden cases, loaded by BOTH test suites
```

Both suites include a sync test that fails if a generated copy drifts from the
canonical spec. Workflow for any rule change: edit spec → `npm run sync-spec` →
add a fixture case → run both suites.

## TypeScript API

```ts
import { scoreImage, scoreAltText, imageInputFromElement, summarize } from '@alt-text/scorer';

scoreAltText('img_1234', 'https://cdn.example.com/img_1234.jpg');
// → { category: 'GENERIC', reason: 'generic-pattern', severity: 'warning',
//     wcag: { criterion: '1.1.1', ... }, suggestedFix: '...', screenReaderFallback: '...' }

// In the extension's content script:
const result = scoreImage(imageInputFromElement(imgElement));

// Popup counts:
summarize(results); // { MISSING: 3, GENERIC: 5, DECORATIVE_UNMARKED: 1, GOOD: 42 }
```

## Python API

```python
from alt_text_scorer import score_image, image_input_from_attrs, summarize

# In the backend crawler, from a BeautifulSoup tag:
result = score_image(image_input_from_attrs(tag.attrs))
result.category        # "GENERIC"
result.reason          # "generic-pattern"
result.wcag.criterion  # "1.1.1"
result.suggested_fix   # template message for the report
```

## Tests

```bash
npm test                                        # TypeScript (vitest)
python3 -m pytest packages/scorer/python/tests  # Python (pytest)
```
