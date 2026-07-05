import browser from 'webextension-polyfill';
import type { BadgeReport, ContentRequest, PageReport } from '../shared/messages';
import { DISABLED_HOSTS_KEY, isHostEnabled, setHostEnabled } from '../shared/settings';
import { AltTextScanner, type ScanSummary } from './scanner';

const SCAN_DEBOUNCE_MS = 200;

const scanner = new AltTextScanner();
let enabled = false;
let lastSummary: ScanSummary | null = null;
let scanTimer: ReturnType<typeof setTimeout> | undefined;

async function runScan(): Promise<void> {
  lastSummary = await scanner.scan(document);
  publishBadge();
}

// Debounced so SPA mutation bursts trigger one re-scan. Our own alt writes
// also land here, but the scanner is idempotent so the loop settles
// immediately instead of ping-ponging.
function scheduleScan(): void {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => void runScan(), SCAN_DEBOUNCE_MS);
}

const observer = new MutationObserver(scheduleScan);

function report(): PageReport {
  return {
    enabled,
    host: location.host,
    total: lastSummary?.total ?? 0,
    counts: lastSummary?.counts ?? null,
  };
}

function publishBadge(): void {
  const message: BadgeReport = { type: 'REPORT', enabled, counts: lastSummary?.counts ?? null };
  // Best-effort: the service worker may be waking up or the extension reloading.
  void browser.runtime.sendMessage(message).catch(() => {});
}

async function enable(): Promise<void> {
  if (enabled) return;
  enabled = true;
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'alt', 'role', 'aria-hidden'],
  });
  await runScan();
}

function disable(): void {
  if (!enabled) return;
  enabled = false;
  observer.disconnect();
  clearTimeout(scanTimer);
  scanner.restore(document);
  lastSummary = null;
  publishBadge();
}

browser.runtime.onMessage.addListener((message: unknown): Promise<PageReport> | undefined => {
  const request = message as ContentRequest;
  if (request?.type === 'GET_REPORT') {
    return (async () => {
      if (enabled && lastSummary === null) await runScan();
      return report();
    })();
  }
  if (request?.type === 'SET_ENABLED') {
    return (async () => {
      await setHostEnabled(location.host, request.enabled);
      if (request.enabled) await enable();
      else disable();
      return report();
    })();
  }
  return undefined;
});

// Settings can change from the popup of another tab or the options page —
// apply them live. enable()/disable() are idempotent, so the echo from our
// own popup-triggered writes is harmless.
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(DISABLED_HOSTS_KEY in changes)) return;
  void (async () => {
    if (await isHostEnabled(location.host)) await enable();
    else disable();
  })();
});

// Once images finish loading their natural dimensions are known, which can
// reclassify tiny/decorative images — worth one follow-up pass.
window.addEventListener('load', () => {
  if (enabled) scheduleScan();
});

void (async () => {
  if (await isHostEnabled(location.host)) await enable();
  else publishBadge();
})();
