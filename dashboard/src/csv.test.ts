import { describe, expect, it } from 'vitest';
import { auditToCsv } from './csv';
import type { AuditResponse } from './types';

const WCAG = {
  criterion: '1.1.1',
  name: 'Non-text Content',
  level: 'A',
  url: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html',
};

function makeAudit(): AuditResponse {
  return {
    requested_url: 'https://example.com/',
    source: 'page',
    generated_at: '2026-07-04T00:00:00Z',
    total_images: 2,
    totals: { MISSING: 1, GENERIC: 1, DECORATIVE_UNMARKED: 0, GOOD: 0 },
    pages: [
      {
        url: 'https://example.com/',
        fetched: true,
        error: null,
        possibly_js_rendered: false,
        counts: { MISSING: 1, GENERIC: 1, DECORATIVE_UNMARKED: 0, GOOD: 0 },
        images: [
          {
            src: 'https://example.com/dog.jpg',
            alt: null,
            category: 'MISSING',
            reason: 'no-alt-attribute',
            severity: 'error',
            label: 'Missing alt text',
            wcag: WCAG,
            suggested_fix: 'Add an alt attribute, e.g. alt="Golden retriever".',
            screen_reader_fallback: 'Image, no description available',
            suggested_caption: null,
          },
          {
            src: 'https://example.com/a.jpg',
            alt: 'img, "1234"\nline two',
            category: 'GENERIC',
            reason: 'generic-pattern',
            severity: 'warning',
            label: 'Generic or placeholder alt text',
            wcag: WCAG,
            suggested_fix: 'Replace the placeholder.',
            screen_reader_fallback: 'Image, description may be unreliable',
            suggested_caption: null,
          },
          {
            src: 'https://example.com/evil.jpg',
            alt: '=HYPERLINK("http://evil.example","click")',
            category: 'GENERIC',
            reason: 'generic-pattern',
            severity: 'warning',
            label: 'Generic or placeholder alt text',
            wcag: WCAG,
            suggested_fix: 'Replace the placeholder.',
            screen_reader_fallback: 'Image, description may be unreliable',
            suggested_caption: null,
          },
        ],
      },
    ],
  };
}

describe('auditToCsv', () => {
  it('emits a header row plus one row per image', () => {
    const lines = auditToCsv(makeAudit()).trimEnd().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(
      'page_url,image_src,alt_text,category,reason,severity,wcag_criterion,suggested_fix',
    );
    expect(lines[1]).toContain('MISSING');
    expect(lines[1]).toContain('(no alt attribute)');
  });

  it('escapes quotes, commas and newlines per RFC 4180', () => {
    const csv = auditToCsv(makeAudit());
    expect(csv).toContain('"img, ""1234""\nline two"');
    // The quoted fix with a comma is wrapped, quotes doubled.
    expect(csv).toContain('"Add an alt attribute, e.g. alt=""Golden retriever""."');
  });

  it('neutralizes spreadsheet formula injection in scraped alt text', () => {
    const csv = auditToCsv(makeAudit());
    expect(csv).toContain('"\'=HYPERLINK(""http://evil.example"",""click"")"');
    expect(csv).not.toContain(',=HYPERLINK');
  });
});
