import { SPEC } from './spec.data.js';
import type { AltTextCategory, ImageInput, ReasonCode, ScoreResult } from './types.js';

const genericWords = new Set(SPEC.genericWords);
const genericAltPatterns = SPEC.genericAltPatterns.map((p) => new RegExp(p, 'i'));
const decorativeFilenamePatterns = SPEC.decorativeFilenamePatterns.map((p) => new RegExp(p, 'i'));
const DECORATIVE_ROLES = new Set(['presentation', 'none']);
const ASCII_ONLY = /^[\x00-\x7f]+$/;

/**
 * Extracts the lowercased filename from a URL-ish src, ignoring query/hash.
 * Returns null for data:/blob: URIs and empty srcs, where a "filename" is meaningless.
 */
function filenameFromSrc(src: string | undefined): string | null {
  if (!src) return null;
  const lower = src.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return null;
  const path = src.split(/[?#]/, 1)[0] ?? src;
  const last = path.split('/').pop();
  if (!last) return null;
  try {
    return decodeURIComponent(last).toLowerCase();
  } catch {
    return last.toLowerCase();
  }
}

function filenameStem(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

function isTiny(width: number | null | undefined, height: number | null | undefined): boolean {
  const { tinyDimensionPx, spacerDimensionPx } = SPEC.thresholds;
  if (width != null && width > 0 && width <= spacerDimensionPx) return true;
  if (height != null && height > 0 && height <= spacerDimensionPx) return true;
  return (
    width != null && height != null && width > 0 && height > 0 && width < tinyDimensionPx && height < tinyDimensionPx
  );
}

/**
 * Scores alt text alone (missing/generic checks), ignoring decorative signals.
 * The full scorer layers the decorative heuristics on top of this.
 */
function baseline(alt: string | null, src: string | undefined): { category: AltTextCategory; reason: ReasonCode } {
  if (alt === null || alt === undefined) return { category: 'MISSING', reason: 'no-alt-attribute' };
  if (alt === '') return { category: 'MISSING', reason: 'empty-alt' };
  const trimmed = alt.trim();
  if (trimmed === '') return { category: 'MISSING', reason: 'whitespace-only-alt' };

  const lower = trimmed.toLowerCase();
  if (genericWords.has(lower)) return { category: 'GENERIC', reason: 'generic-word' };
  if (genericAltPatterns.some((p) => p.test(lower))) return { category: 'GENERIC', reason: 'generic-pattern' };

  const filename = filenameFromSrc(src);
  if (filename && (lower === filename || lower === filenameStem(filename))) {
    return { category: 'GENERIC', reason: 'matches-filename' };
  }

  if (
    !/\s/.test(trimmed) &&
    ASCII_ONLY.test(trimmed) &&
    trimmed.length < SPEC.thresholds.minSingleWordLength
  ) {
    return { category: 'GENERIC', reason: 'single-short-word' };
  }

  return { category: 'GOOD', reason: 'descriptive' };
}

function result(category: AltTextCategory, reason: ReasonCode): ScoreResult {
  const meta = SPEC.categories[category];
  return {
    category,
    reason,
    severity: meta.severity,
    label: meta.label,
    wcag: meta.wcag,
    suggestedFix: meta.suggestedFix,
    screenReaderFallback: meta.screenReaderFallback,
  };
}

/**
 * Rule-based alt text scorer. Pure function, no I/O, no network.
 *
 * Evaluation order:
 * 1. role="presentation"/"none" or aria-hidden="true" → GOOD (author opted out).
 * 2. Image looks decorative (tiny dimensions or spacer/divider-style filename):
 *    alt="" → GOOD; otherwise, if the alt is missing or generic → DECORATIVE_UNMARKED.
 *    A tiny image with genuinely descriptive alt (a labelled 16px icon) stays GOOD.
 * 3. Otherwise MISSING / GENERIC / GOOD from the alt text itself.
 */
export function scoreImage(input: ImageInput): ScoreResult {
  const role = input.role?.trim().toLowerCase();
  if ((role && DECORATIVE_ROLES.has(role)) || input.ariaHidden === true) {
    return result('GOOD', 'explicitly-marked-decorative');
  }

  const base = baseline(input.alt, input.src);

  const tiny = isTiny(input.width, input.height);
  const filename = filenameFromSrc(input.src);
  const decorativeName = filename !== null && decorativeFilenamePatterns.some((p) => p.test(filename));
  if (tiny || decorativeName) {
    if (input.alt === '') return result('GOOD', 'decorative-correctly-marked');
    if (base.category !== 'GOOD') {
      return result('DECORATIVE_UNMARKED', tiny ? 'tiny-image-unmarked' : 'decorative-filename-unmarked');
    }
  }

  return result(base.category, base.reason);
}

/** Convenience wrapper when all you have is the alt string and src. */
export function scoreAltText(alt: string | null, src = ''): ScoreResult {
  return scoreImage({ alt, src });
}

/** Counts results per category — what the extension popup and dashboard both display. */
export function summarize(results: Iterable<Pick<ScoreResult, 'category'>>): Record<AltTextCategory, number> {
  const counts: Record<AltTextCategory, number> = { MISSING: 0, GENERIC: 0, DECORATIVE_UNMARKED: 0, GOOD: 0 };
  for (const r of results) counts[r.category] += 1;
  return counts;
}
