import { imageInputFromElement, scoreImage, summarize } from '@alt-text/scorer';
import type { AltTextCategory, ScoreResult } from '@alt-text/scorer';
import { getCaptionForImage } from './captioning';

/**
 * Marker attribute set on images whose alt we replaced. Doubles as a hook for
 * user styles/debugging and as the selector used to restore originals.
 */
export const MARKER_ATTR = 'data-altguard';

export type CategoryCounts = Record<AltTextCategory, number>;

export interface ScanSummary {
  total: number;
  counts: CategoryCounts;
}

interface ImgState {
  src: string;
  /** The alt as the page author left it (null = attribute absent). */
  authorAlt: string | null;
  /** Exactly what we wrote into the alt attribute, or null if we didn't. */
  injectedAlt: string | null;
  result: ScoreResult;
}

/**
 * Scans <img> elements, scores them with the shared rule-based scorer, and
 * replaces MISSING/GENERIC alt text with a meaningful screen-reader
 * announcement. Pure DOM logic — no browser.* APIs — so it runs under jsdom
 * in unit tests. Re-scanning is idempotent: unchanged images are skipped, and
 * our own alt mutations never trigger reclassification because scoring always
 * uses the author's original alt.
 */
export class AltTextScanner {
  private states = new WeakMap<HTMLImageElement, ImgState>();

  async scan(root: ParentNode): Promise<ScanSummary> {
    const imgs = Array.from(root.querySelectorAll('img'));
    const results: ScoreResult[] = [];
    for (const img of imgs) {
      results.push(await this.process(img));
    }
    return { total: imgs.length, counts: summarize(results) };
  }

  /** Undo every injected alt and drop all tracking state. */
  restore(root: ParentNode): void {
    for (const el of Array.from(root.querySelectorAll(`img[${MARKER_ATTR}]`))) {
      const img = el as HTMLImageElement;
      const state = this.states.get(img);
      if (state && state.injectedAlt !== null && img.getAttribute('alt') === state.injectedAlt) {
        if (state.authorAlt === null) img.removeAttribute('alt');
        else img.setAttribute('alt', state.authorAlt);
      }
      img.removeAttribute(MARKER_ATTR);
      this.states.delete(img);
    }
  }

  /**
   * The alt the page author is responsible for: if our injected value is
   * still in place, the stored original; otherwise whatever is in the DOM
   * (first visit, or the author/app changed it after we injected).
   */
  private authorAltOf(img: HTMLImageElement): string | null {
    const state = this.states.get(img);
    const current = img.getAttribute('alt');
    if (state && state.injectedAlt !== null && current === state.injectedAlt) {
      return state.authorAlt;
    }
    return current;
  }

  private async process(img: HTMLImageElement): Promise<ScoreResult> {
    const authorAlt = this.authorAltOf(img);
    const src = img.currentSrc || img.getAttribute('src') || '';

    const prev = this.states.get(img);
    if (prev && prev.src === src && prev.authorAlt === authorAlt) {
      return prev.result;
    }

    const result = scoreImage({ ...imageInputFromElement(img), alt: authorAlt, src });

    let injectedAlt: string | null = null;
    if (result.screenReaderFallback !== null) {
      // MISSING or GENERIC — announce something meaningful. A future
      // captioning backend slots in here; see captioning.ts.
      const caption = await getCaptionForImage(img);
      // For GENERIC, keep the author's text after the warning — it may still
      // carry a hint ("Image, description may be unreliable: img_1234").
      const fallback =
        result.category === 'GENERIC' && authorAlt && authorAlt.trim() !== ''
          ? `${result.screenReaderFallback}: ${authorAlt.trim()}`
          : result.screenReaderFallback;
      injectedAlt = caption ?? fallback;
      img.setAttribute('alt', injectedAlt);
      img.setAttribute(MARKER_ATTR, result.category.toLowerCase());
    } else if (img.hasAttribute(MARKER_ATTR)) {
      // Previously flagged, now fine (the author fixed it) — clear our mark.
      img.removeAttribute(MARKER_ATTR);
    }

    this.states.set(img, { src, authorAlt, injectedAlt, result });
    return result;
  }
}
