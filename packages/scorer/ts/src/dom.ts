import type { ImageInput } from './types.js';

/**
 * Structural subset of HTMLImageElement, so this module compiles without the
 * DOM lib and stays testable outside a browser.
 */
export interface ImgElementLike {
  getAttribute(name: string): string | null;
  naturalWidth?: number;
  naturalHeight?: number;
  currentSrc?: string;
}

function dimension(natural: number | undefined, attrValue: string | null): number | null {
  if (natural !== undefined && natural > 0) return natural;
  if (attrValue === null) return null;
  const parsed = Number.parseInt(attrValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Builds an ImageInput from a live <img> element (or anything shaped like one).
 * Prefers intrinsic (natural) dimensions, falling back to width/height attributes;
 * 0 means "not loaded yet" and is treated as unknown.
 */
export function imageInputFromElement(el: ImgElementLike): ImageInput {
  return {
    alt: el.getAttribute('alt'),
    src: el.currentSrc || el.getAttribute('src') || '',
    width: dimension(el.naturalWidth, el.getAttribute('width')),
    height: dimension(el.naturalHeight, el.getAttribute('height')),
    role: el.getAttribute('role'),
    ariaHidden: el.getAttribute('aria-hidden') === 'true',
  };
}
