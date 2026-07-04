import { useState, type FormEvent } from 'react';

export function AuditForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (url: string, maxPages: number) => void;
}) {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(5);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onSubmit(trimmed, maxPages);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="audit-url" className="mb-1 block text-sm font-semibold">
          Page URL or sitemap.xml
        </label>
        <input
          id="audit-url"
          type="url"
          required
          placeholder="https://example.com or https://example.com/sitemap.xml"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-ink placeholder:text-muted"
        />
      </div>
      <div>
        <label htmlFor="audit-pages" className="mb-1 block text-sm font-semibold">
          Max pages
        </label>
        <select
          id="audit-pages"
          value={maxPages}
          onChange={(event) => setMaxPages(Number(event.target.value))}
          className="rounded-md border border-border bg-bg px-3 py-2 text-ink"
        >
          {[1, 5, 10, 20].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md border-2 border-ink bg-ink px-5 py-2 font-semibold text-bg disabled:opacity-60"
      >
        {loading ? 'Auditing…' : 'Run audit'}
      </button>
    </form>
  );
}
