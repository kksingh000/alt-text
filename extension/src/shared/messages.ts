import type { AltTextCategory } from '@alt-text/scorer';

export type CategoryCounts = Record<AltTextCategory, number>;

/** Content script → popup, in response to GET_REPORT / SET_ENABLED. */
export interface PageReport {
  enabled: boolean;
  host: string;
  total: number;
  /** null while a scan hasn't run (disabled, or still pending). */
  counts: CategoryCounts | null;
}

/** Popup → content script. */
export type ContentRequest = { type: 'GET_REPORT' } | { type: 'SET_ENABLED'; enabled: boolean };

/** Content script → background service worker (badge updates). */
export interface BadgeReport {
  type: 'REPORT';
  enabled: boolean;
  counts: CategoryCounts | null;
}
