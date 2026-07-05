import { beforeEach, describe, expect, it } from 'vitest';
import { AltTextScanner, MARKER_ATTR, ORIGINAL_ALT_ATTR } from '../src/content/scanner';

function addImg(attrs: Record<string, string>): HTMLImageElement {
  const img = document.createElement('img');
  for (const [name, value] of Object.entries(attrs)) img.setAttribute(name, value);
  document.body.appendChild(img);
  return img;
}

describe('AltTextScanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('injects the screen-reader fallback for a missing alt', async () => {
    const img = addImg({ src: 'https://example.com/dog.jpg' });
    const scanner = new AltTextScanner();

    const summary = await scanner.scan(document);

    expect(summary.total).toBe(1);
    expect(summary.counts.MISSING).toBe(1);
    expect(img.getAttribute('alt')).toBe('Image, no description available');
    expect(img.getAttribute(MARKER_ATTR)).toBe('missing');
  });

  it('prefixes generic alt with a warning but keeps the original text', async () => {
    const img = addImg({ src: 'https://example.com/a.jpg', alt: 'img_1234' });
    const scanner = new AltTextScanner();

    const summary = await scanner.scan(document);

    expect(summary.counts.GENERIC).toBe(1);
    expect(img.getAttribute('alt')).toBe('Image, description may be unreliable: img_1234');
    expect(img.getAttribute(MARKER_ATTR)).toBe('generic');
  });

  it('leaves good alt text and unmarked-decorative images untouched', async () => {
    const good = addImg({
      src: 'https://example.com/cat.jpg',
      alt: 'A tabby cat sleeping on a windowsill',
    });
    const spacer = addImg({ src: 'https://example.com/promo.gif', width: '1', height: '1' });
    const scanner = new AltTextScanner();

    const summary = await scanner.scan(document);

    expect(summary.counts.GOOD).toBe(1);
    expect(summary.counts.DECORATIVE_UNMARKED).toBe(1);
    expect(good.getAttribute('alt')).toBe('A tabby cat sleeping on a windowsill');
    expect(good.hasAttribute(MARKER_ATTR)).toBe(false);
    // We report unmarked-decorative images but never rewrite page semantics.
    expect(spacer.hasAttribute('alt')).toBe(false);
    expect(spacer.hasAttribute(MARKER_ATTR)).toBe(false);
  });

  it('is idempotent: re-scanning changes nothing and never re-scores its own injection', async () => {
    const img = addImg({ src: 'https://example.com/a.jpg', alt: 'img_1234' });
    const scanner = new AltTextScanner();

    const first = await scanner.scan(document);
    const altAfterFirst = img.getAttribute('alt');
    const second = await scanner.scan(document);

    expect(second).toEqual(first);
    expect(img.getAttribute('alt')).toBe(altAfterFirst);
    // Still classified from the author's alt, not our injected text.
    expect(second.counts.GENERIC).toBe(1);
    expect(second.counts.GOOD).toBe(0);
  });

  it('restore() puts the author alt back exactly, including absent attributes', async () => {
    const missing = addImg({ src: 'https://example.com/dog.jpg' });
    const generic = addImg({ src: 'https://example.com/a.jpg', alt: 'img_1234' });
    const scanner = new AltTextScanner();
    await scanner.scan(document);

    scanner.restore(document);

    expect(missing.hasAttribute('alt')).toBe(false);
    expect(missing.hasAttribute(MARKER_ATTR)).toBe(false);
    expect(generic.getAttribute('alt')).toBe('img_1234');
    expect(generic.hasAttribute(MARKER_ATTR)).toBe(false);
  });

  it('respects an author fix applied after injection', async () => {
    const img = addImg({ src: 'https://example.com/a.jpg', alt: 'img_1234' });
    const scanner = new AltTextScanner();
    await scanner.scan(document);

    img.setAttribute('alt', 'A brown dog running through shallow surf');
    const summary = await scanner.scan(document);

    expect(summary.counts.GOOD).toBe(1);
    expect(summary.counts.GENERIC).toBe(0);
    expect(img.getAttribute('alt')).toBe('A brown dog running through shallow surf');
    expect(img.hasAttribute(MARKER_ATTR)).toBe(false);
  });

  it('re-scores when dimensions become known (window load / lazy load)', async () => {
    const img = addImg({ src: 'https://example.com/track.gif' });
    const scanner = new AltTextScanner();
    const before = await scanner.scan(document);
    expect(before.counts.MISSING).toBe(1);

    // Dimension attributes arrive later (or natural size becomes known).
    img.setAttribute('width', '1');
    img.setAttribute('height', '1');
    const after = await scanner.scan(document);

    expect(after.counts.MISSING).toBe(0);
    expect(after.counts.DECORATIVE_UNMARKED).toBe(1);
  });

  it('restores originals from persisted attributes after a context reload', async () => {
    const missing = addImg({ src: 'https://example.com/dog.jpg' });
    const generic = addImg({ src: 'https://example.com/a.jpg', alt: 'img_1234' });
    const first = new AltTextScanner();
    await first.scan(document);
    expect(generic.getAttribute(ORIGINAL_ALT_ATTR)).toBe('img_1234');

    // Fresh scanner = fresh WeakMap, as after an extension update/reload.
    const second = new AltTextScanner();
    const summary = await second.scan(document);
    // Does NOT adopt its own injected text as author content:
    expect(summary.counts.GENERIC).toBe(1);
    expect(summary.counts.MISSING).toBe(1);

    second.restore(document);
    expect(missing.hasAttribute('alt')).toBe(false);
    expect(generic.getAttribute('alt')).toBe('img_1234');
    expect(generic.hasAttribute(ORIGINAL_ALT_ATTR)).toBe(false);
  });

  it('stops writing to the DOM when cancelled mid-scan', async () => {
    const img = addImg({ src: 'https://example.com/dog.jpg' });
    const scanner = new AltTextScanner();

    await scanner.scan(document, () => true);

    expect(img.hasAttribute('alt')).toBe(false);
    expect(img.hasAttribute(MARKER_ATTR)).toBe(false);
  });

  it('re-scores when an SPA swaps the image src', async () => {
    const img = addImg({ src: 'https://example.com/spacer.gif', width: '1', height: '1' });
    const scanner = new AltTextScanner();
    const before = await scanner.scan(document);
    expect(before.counts.DECORATIVE_UNMARKED).toBe(1);

    img.setAttribute('src', 'https://example.com/hero.jpg');
    img.removeAttribute('width');
    img.removeAttribute('height');
    const after = await scanner.scan(document);

    expect(after.counts.DECORATIVE_UNMARKED).toBe(0);
    expect(after.counts.MISSING).toBe(1);
    expect(img.getAttribute('alt')).toBe('Image, no description available');
  });
});
