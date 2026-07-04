import type { AuditResponse } from './types';

// Empty in dev (Vite proxies /api to localhost:8000); set VITE_API_URL to the
// Render service URL in the Vercel project settings for production.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {}

export async function runAudit(url: string, maxPages: number): Promise<AuditResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/audit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, max_pages: maxPages }),
    });
  } catch {
    throw new ApiError('Could not reach the audit API. Is the backend running?');
  }
  if (!response.ok) {
    let detail = `The audit API returned HTTP ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (
        typeof body === 'object' &&
        body !== null &&
        'detail' in body &&
        typeof (body as { detail: unknown }).detail === 'string'
      ) {
        detail = (body as { detail: string }).detail;
      }
    } catch {
      // keep the generic message
    }
    throw new ApiError(detail);
  }
  return (await response.json()) as AuditResponse;
}
