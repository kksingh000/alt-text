import { CATEGORY_ORDER, SPEC } from '@alt-text/scorer';
import type { AltTextCategory, CategoryCounts } from '../types';

const DOTS: Record<AltTextCategory, string> = {
  MISSING: 'bg-missing',
  GENERIC: 'bg-generic',
  DECORATIVE_UNMARKED: 'bg-decorative',
  GOOD: 'bg-good',
};

/**
 * Stat tiles. Values wear ink (text tokens), never the category color — the
 * colored mark next to the label carries identity.
 */
export function SummaryTiles({ totals, totalImages }: { totals: CategoryCounts; totalImages: number }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <div className="rounded-lg border border-border bg-surface p-4">
        <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Images scanned</dt>
        <dd className="mt-1 text-3xl font-bold text-ink">{totalImages}</dd>
      </div>
      {CATEGORY_ORDER.map((key) => (
        <div key={key} className="rounded-lg border border-border bg-surface p-4">
          <dt
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted"
            title={SPEC.categories[key].description}
          >
            <span className={`h-2 w-2 flex-none rounded-full ${DOTS[key]}`} aria-hidden="true" />
            {SPEC.categories[key].shortLabel}
          </dt>
          <dd className="mt-1 text-3xl font-bold text-ink">{totals[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
