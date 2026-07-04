/**
 * Extension point for a future image-captioning backend (e.g. a free-tier
 * vision model like Gemini Flash). This is deliberately the ONLY place in the
 * extension where such a call would ever be added — the scanner already
 * awaits it for every MISSING/GENERIC image.
 *
 * Returning null means "no caption available", and the caller falls back to
 * the scorer's static screen-reader fallback text. To wire up a real
 * captioner later, implement this function (fetch to your backend, cache by
 * src, rate-limit) — nothing else in the codebase needs to change.
 */
export async function getCaptionForImage(_img: HTMLImageElement): Promise<string | null> {
  return null;
}
