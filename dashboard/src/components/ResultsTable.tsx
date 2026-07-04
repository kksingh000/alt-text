import type { AltTextCategory, AuditResponse, ImageResult } from '../types';
import { Badge } from './Badge';

interface Row {
  pageUrl: string;
  image: ImageResult;
}

function Thumb({ src }: { src: string }) {
  if (!src) {
    return <div className="h-12 w-12 rounded border border-border bg-surface" aria-hidden="true" />;
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-12 w-12 rounded border border-border bg-surface object-cover"
      onError={(event) => {
        event.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

export function ResultsTable({
  audit,
  filter,
}: {
  audit: AuditResponse;
  filter: AltTextCategory | 'ALL';
}) {
  const multiPage = audit.pages.length > 1;
  const rows: Row[] = audit.pages.flatMap((page) =>
    page.images
      .filter((image) => filter === 'ALL' || image.category === filter)
      .map((image) => ({ pageUrl: page.url, image })),
  );

  if (rows.length === 0) {
    return <p className="text-muted">No images in this category.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          Image alt text audit results with category, WCAG reference and suggested fix
        </caption>
        <thead>
          <tr className="border-b-2 border-ink bg-surface text-xs uppercase tracking-wider">
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Preview
            </th>
            {multiPage && (
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Page
              </th>
            )}
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Current alt text
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Category
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              WCAG
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Suggested fix
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ pageUrl, image }, index) => (
            <tr key={`${pageUrl}-${image.src}-${index}`} className="border-b border-border align-top">
              <td className="px-3 py-2.5">
                <Thumb src={image.src} />
              </td>
              {multiPage && (
                <td className="max-w-44 truncate px-3 py-2.5 text-muted" title={pageUrl}>
                  {pageUrl}
                </td>
              )}
              <td className="max-w-64 px-3 py-2.5">
                {image.alt === null || image.alt.trim() === '' ? (
                  <span className="italic text-muted">
                    {image.alt === null ? 'no alt attribute' : 'empty alt'}
                  </span>
                ) : (
                  <code className="break-words font-mono text-xs">{image.alt}</code>
                )}
              </td>
              <td className="px-3 py-2.5">
                <Badge category={image.category} />
              </td>
              <td className="whitespace-nowrap px-3 py-2.5">
                <a
                  href={image.wcag.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline decoration-1 underline-offset-2"
                >
                  {image.wcag.criterion} {image.wcag.name}
                </a>
                <span className="text-muted"> · Level {image.wcag.level}</span>
              </td>
              <td className="max-w-96 px-3 py-2.5 text-muted">{image.suggested_fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
