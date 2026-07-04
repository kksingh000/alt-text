import type { AltTextCategory, CategoryCounts } from '../types';

const TILES: Array<{ key: AltTextCategory; label: string; dot: string }> = [
  { key: 'MISSING', label: 'Missing', dot: 'bg-missing' },
  { key: 'GENERIC', label: 'Generic', dot: 'bg-generic' },
  { key: 'DECORATIVE_UNMARKED', label: 'Unmarked decorative', dot: 'bg-decorative' },
  { key: 'GOOD', label: 'Good', dot: 'bg-good' },
];

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
      {TILES.map(({ key, label, dot }) => (
        <div key={key} className="rounded-lg border border-border bg-surface p-4">
          <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
            <span className={`h-2 w-2 flex-none rounded-full ${dot}`} aria-hidden="true" />
            {label}
          </dt>
          <dd className="mt-1 text-3xl font-bold text-ink">{totals[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
