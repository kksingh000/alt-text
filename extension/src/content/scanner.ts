import { imageInputFromElement, scoreImage, summarize } from '@alt-text/scorer';
import type { CategoryCounts, ScoreResult } from '@alt-text/scorer';
import { getCaptionForImage } from './captioning';

/**
 * Marker attribute set on images whose alt we replaced. Doubles as a hook for
 * user styles/debugging and as the selector used to restore originals.
 */
export const MARKER_ATTR = 'data-altguard';

/**
 * The author's original alt, persisted in the DOM alongside the marker so a
 * fresh content-script context (extension update/reload, bfcache restore) can
 * still restore it — attribute absent means the author had no alt at all.
 */
export const ORIGINAL_ALT_ATTR = 'data-altguard-orig';

export type { CategoryCounts };

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
  width: number | null;
  height: number | null;
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

  /**
   * `isCancelled` is polled between images and after every await so a
   * disable() that lands mid-scan stops further DOM writes immediately.
   */
  async scan(root: ParentNode, isCancelled?: () => boolean): Promise<ScanSummary> {
    const imgs = Array.from(root.querySelectorAll('img'));
    const results: ScoreResult[] = [];
    for (const img of imgs) {
      if (isCancelled?.()) break;
      const outcome = this.process(img, isCancelled);
      results.push(outcome instanceof Promise ? await outcome : outcome);
    }
    return { total: imgs.length, counts: summarize(results) };
  }

  /** Undo every injected alt and drop all tracking state. */
  restore(root: ParentNode): void {
    for (const el of Array.from(root.querySelectorAll(`img[${MARKER_ATTR}]`))) {
      const img = el as HTMLImageElement;
      const state = this.states.get(img);
      if (state && state.injectedAlt !== null) {
        // Only restore if our injection is still in place — never clobber an
        // alt the author changed after we wrote ours.
        if (img.getAttribute('alt') === state.injectedAlt) {
          if (state.authorAlt === null) img.removeAttribute('alt');
          else img.setAttribute('alt', state.authorAlt);
        }
      } else {
        // Injected by a previous content-script context; the original
        // survives in the attribute.
        const original = img.getAttribute(ORIGINAL_ALT_ATTR);
        if (original === null) img.removeAttribute('alt');
        else img.setAttribute('alt', original);
      }
      img.removeAttribute(MARKER_ATTR);
      img.removeAttribute(ORIGINAL_ALT_ATTR);
      this.states.delete(img);
    }
  }

  /**
   * The alt the page author is responsible for: if our injected value is
   * still in place, the stored original; otherwise whatever is in the DOM
   * (first visit, or the author/app changed it after we injected).
   */
  private authorAltOf(img: HTMLImageElement, currentAlt: string | null): string | null {
    const state = this.states.get(img);
    if (state && state.injectedAlt !== null && currentAlt === state.injectedAlt) {
      return state.authorAlt;
    }
    if (!state && img.hasAttribute(MARKER_ATTR)) {
      // Marked by a previous content-script context — don't adopt our own
      // injected text as the author's alt.
      return img.getAttribute(ORIGINAL_ALT_ATTR);
    }
    return currentAlt;
  }

  /**
   * Returns synchronously for unchanged or non-flagged images (the common
   * case on re-scans) and goes async only when an injection — and therefore
   * the captioning hook — is involved.
   */
  private process(
    img: HTMLImageElement,
    isCancelled?: () => boolean,
  ): ScoreResult | Promise<ScoreResult> {
    const input = imageInputFromElement(img);
    const authorAlt = this.authorAltOf(img, input.alt);
    const src = input.src ?? '';
    const width = input.width ?? null;
    const height = input.height ?? null;

    const prev = this.states.get(img);
    if (
      prev &&
      prev.src === src &&
      prev.authorAlt === authorAlt &&
      prev.width === width &&
      prev.height === height
    ) {
      return prev.result;
    }

    const result = scoreImage({ ...input, alt: authorAlt });
    const state: ImgState = { src, authorAlt, injectedAlt: null, width, height, result };

    if (result.screenReaderFallback === null) {
      if (img.hasAttribute(MARKER_ATTR)) {
        // Previously flagged, now fine (the author fixed it) — clear our mark.
        img.removeAttribute(MARKER_ATTR);
        img.removeAttribute(ORIGINAL_ALT_ATTR);
      }
      this.states.set(img, state);
      return result;
    }
    return this.inject(img, state, isCancelled);
  }

  private async inject(
    img: HTMLImageElement,
    state: ImgState,
    isCancelled?: () => boolean,
  ): Promise<ScoreResult> {
    const { authorAlt, result } = state;
    const altBefore = img.getAttribute('alt');

    // MISSING or GENERIC — announce something meaningful. A future
    // captioning backend slots in here; see captioning.ts.
    const caption = await getCaptionForImage(img);

    // Re-validate after the await: scanning may have been disabled, the img
    // detached, or the page's own JS may have set a real alt meanwhile.
    if (isCancelled?.() || !img.isConnected || img.getAttribute('alt') !== altBefore) {
      return result;
    }

    // For GENERIC, keep the author's text after the warning — it may still
    // carry a hint ("Image, description may be unreliable: img_1234").
    const fallback =
      result.category === 'GENERIC' && authorAlt && authorAlt.trim() !== ''
        ? `${result.screenReaderFallback}: ${authorAlt.trim()}`
        : (result.screenReaderFallback as string);
    state.injectedAlt = caption ?? fallback;

    if (authorAlt === null) img.removeAttribute(ORIGINAL_ALT_ATTR);
    else img.setAttribute(ORIGINAL_ALT_ATTR, authorAlt);
    img.setAttribute('alt', state.injectedAlt);
    img.setAttribute(MARKER_ATTR, result.category.toLowerCase());
    this.states.set(img, state);
    return result;
  }
}
