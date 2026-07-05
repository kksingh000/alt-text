import type { AuditResponse } from './types';

const HEADERS = [
  'page_url',
  'image_src',
  'alt_text',
  'category',
  'reason',
  'severity',
  'wcag_criterion',
  'suggested_fix',
] as const;

function escapeCell(value: string): string {
  // Alt text is scraped from arbitrary sites: neutralize spreadsheet formula
  // injection (=, +, -, @, tab, CR at cell start) before RFC 4180 quoting.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

export function auditToCsv(audit: AuditResponse): string {
  const lines = [HEADERS.join(',')];
  for (const page of audit.pages) {
    for (const image of page.images) {
      lines.push(
        [
          page.url,
          image.src,
          image.alt ?? '(no alt attribute)',
          image.category,
          image.reason,
          image.severity,
          `${image.wcag.criterion} ${image.wcag.name} (Level ${image.wcag.level})`,
          image.suggested_fix,
        ]
          .map(escapeCell)
          .join(','),
      );
    }
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
