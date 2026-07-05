import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { imageInputFromElement, scoreAltText, scoreImage, summarize, SPEC } from '../src/index.js';
import type { ImageInput } from '../src/index.js';

const specDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'spec');

interface FixtureCase {
  name: string;
  input: ImageInput;
  expected: { category: string; reason: string };
}

describe('golden fixtures (shared with the Python implementation)', () => {
  const { cases } = JSON.parse(readFileSync(join(specDir, 'fixtures.json'), 'utf8')) as { cases: FixtureCase[] };

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const result = scoreImage(c.input);
    expect({ category: result.category, reason: result.reason }).toEqual(c.expected);
  });
});

describe('spec sync', () => {
  it('vendored spec.data.ts matches the canonical spec JSON', () => {
    const canonical = JSON.parse(readFileSync(join(specDir, 'scorer.spec.json'), 'utf8'));
    expect(JSON.parse(JSON.stringify(SPEC))).toEqual(canonical);
  });
});

describe('result metadata', () => {
  it('attaches WCAG reference and suggested fix from the spec', () => {
    const result = scoreAltText(null, 'https://example.com/a.jpg');
    expect(result.category).toBe('MISSING');
    expect(result.severity).toBe('error');
    expect(result.wcag.criterion).toBe('1.1.1');
    expect(result.suggestedFix).toContain('alt');
    expect(result.screenReaderFallback).toBe('Image, no description available');
  });

  it('GOOD results carry no screen reader fallback', () => {
    const result = scoreAltText('Golden retriever catching a red frisbee');
    expect(result.category).toBe('GOOD');
    expect(result.severity).toBe('pass');
    expect(result.screenReaderFallback).toBeNull();
  });
});

describe('imageInputFromElement', () => {
  function fakeImg(attrs: Record<string, string>, extras: { naturalWidth?: number; naturalHeight?: number; currentSrc?: string } = {}) {
    return {
      getAttribute: (name: string) => (name in attrs ? attrs[name]! : null),
      ...extras,
    };
  }

  it('maps a missing alt attribute to null', () => {
    const input = imageInputFromElement(fakeImg({ src: 'https://x.com/a.jpg' }));
    expect(input.alt).toBeNull();
    expect(input.src).toBe('https://x.com/a.jpg');
  });

  it('prefers natural dimensions over attributes and treats 0 as unknown', () => {
    const loaded = imageInputFromElement(fakeImg({ width: '100', height: '50' }, { naturalWidth: 800, naturalHeight: 600 }));
    expect(loaded.width).toBe(800);
    expect(loaded.height).toBe(600);

    const notLoaded = imageInputFromElement(fakeImg({ width: '100' }, { naturalWidth: 0, naturalHeight: 0 }));
    expect(notLoaded.width).toBe(100);
    expect(notLoaded.height).toBeNull();
  });

  it('reads aria-hidden and role', () => {
    const input = imageInputFromElement(fakeImg({ alt: 'x', role: 'presentation', 'aria-hidden': 'true' }));
    expect(input.role).toBe('presentation');
    expect(input.ariaHidden).toBe(true);
    expect(scoreImage(input).category).toBe('GOOD');
  });

  it('parses aria-hidden case-insensitively with whitespace, like the Python mirror', () => {
    expect(imageInputFromElement(fakeImg({ 'aria-hidden': ' True ' })).ariaHidden).toBe(true);
    expect(imageInputFromElement(fakeImg({ 'aria-hidden': 'false' })).ariaHidden).toBe(false);
  });

  it('rejects percentage and junk dimension attributes instead of truncating them', () => {
    const percent = imageInputFromElement(fakeImg({ width: '2%', height: '100%' }));
    expect(percent.width).toBeNull();
    expect(percent.height).toBeNull();
    expect(imageInputFromElement(fakeImg({ width: ' 16 ' })).width).toBe(16);
  });
});

describe('summarize', () => {
  it('tallies categories, defaulting to zero', () => {
    const results = [
      scoreAltText(null),
      scoreAltText('image'),
      scoreAltText('A red bicycle leaning against a brick wall'),
      scoreAltText('img_2024'),
    ];
    expect(summarize(results)).toEqual({ MISSING: 1, GENERIC: 2, DECORATIVE_UNMARKED: 0, GOOD: 1 });
  });
});
