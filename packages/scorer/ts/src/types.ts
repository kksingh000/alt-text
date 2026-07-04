export type AltTextCategory = 'MISSING' | 'GENERIC' | 'DECORATIVE_UNMARKED' | 'GOOD';

export type ReasonCode =
  // MISSING
  | 'no-alt-attribute'
  | 'empty-alt'
  | 'whitespace-only-alt'
  // GENERIC
  | 'generic-word'
  | 'generic-pattern'
  | 'matches-filename'
  | 'single-short-word'
  // DECORATIVE_UNMARKED
  | 'tiny-image-unmarked'
  | 'decorative-filename-unmarked'
  // GOOD
  | 'explicitly-marked-decorative'
  | 'decorative-correctly-marked'
  | 'descriptive';

export type Severity = 'error' | 'warning' | 'pass';

export interface WcagReference {
  criterion: string;
  name: string;
  level: string;
  url: string;
}

export interface CategoryMeta {
  label: string;
  severity: Severity;
  wcag: WcagReference;
  suggestedFix: string;
  screenReaderFallback: string | null;
}

export interface ScorerSpec {
  version: number;
  genericWords: string[];
  genericAltPatterns: string[];
  decorativeFilenamePatterns: string[];
  thresholds: {
    tinyDimensionPx: number;
    spacerDimensionPx: number;
    minSingleWordLength: number;
  };
  categories: Record<AltTextCategory, CategoryMeta>;
}

/**
 * Language-neutral description of an <img>. Built from a live DOM element in
 * the extension (see dom.ts) or from parsed HTML attributes on the backend.
 */
export interface ImageInput {
  /** Value of the alt attribute; null means the attribute is absent entirely. */
  alt: string | null;
  src?: string;
  /** Rendered or intrinsic size in px; null/undefined when unknown. */
  width?: number | null;
  height?: number | null;
  role?: string | null;
  ariaHidden?: boolean;
}

export interface ScoreResult {
  category: AltTextCategory;
  /** Stable machine-readable code for the specific rule that fired. */
  reason: ReasonCode;
  severity: Severity;
  label: string;
  wcag: WcagReference;
  suggestedFix: string;
  /** Text the extension can announce to screen readers; null when no announcement is needed. */
  screenReaderFallback: string | null;
}
