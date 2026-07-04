import type { AltTextCategory } from '../types';

const STYLES: Record<AltTextCategory, { text: string; border: string; dot: string; label: string }> = {
  MISSING: { text: 'text-missing', border: 'border-missing', dot: 'bg-missing', label: 'Missing' },
  GENERIC: { text: 'text-generic', border: 'border-generic', dot: 'bg-generic', label: 'Generic' },
  DECORATIVE_UNMARKED: {
    text: 'text-decorative',
    border: 'border-decorative',
    dot: 'bg-decorative',
    label: 'Unmarked decorative',
  },
  GOOD: { text: 'text-good', border: 'border-good', dot: 'bg-good', label: 'Good' },
};

/** Category chip: colored mark + text label — never color alone. */
export function Badge({ category }: { category: AltTextCategory }) {
  const style = STYLES[category];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.text} ${style.border}`}
    >
      <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}
