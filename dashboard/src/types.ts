// Mirrors the FastAPI response models in backend/app/models.py.

export type AltTextCategory = 'MISSING' | 'GENERIC' | 'DECORATIVE_UNMARKED' | 'GOOD';

export type CategoryCounts = Record<AltTextCategory, number>;

export interface WcagRef {
  criterion: string;
  name: string;
  level: string;
  url: string;
}

export interface ImageResult {
  src: string;
  alt: string | null;
  category: AltTextCategory;
  reason: string;
  severity: 'error' | 'warning' | 'pass';
  label: string;
  wcag: WcagRef;
  suggested_fix: string;
  suggested_caption: string | null;
}

export interface PageResult {
  url: string;
  fetched: boolean;
  error: string | null;
  possibly_js_rendered: boolean;
  images: ImageResult[];
  counts: CategoryCounts;
}

export interface AuditResponse {
  requested_url: string;
  source: 'page' | 'sitemap';
  pages: PageResult[];
  totals: CategoryCounts;
  total_images: number;
  generated_at: string;
}
