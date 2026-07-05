import browser from 'webextension-polyfill';
import type { BadgeReport, ContentRequest, PageReport } from '../shared/messages';
import { DISABLED_HOSTS_KEY, isHostEnabled, setHostEnabled } from '../shared/settings';
import { AltTextScanner, type ScanSummary } from './scanner';

const SCAN_DEBOUNCE_MS = 200;

const scanner = new AltTextScanner();
let enabled = false;
let lastSummary: ScanSummary | null = null;
let scanTimer: ReturnType<typeof setTimeout> | undefined;
// Bumped by disable(); an in-flight scan sees the change, stops writing to
// the DOM, and its (stale) summary is discarded.
let generation = 0;
// Serializes scans so two runScan() calls can never interleave DOM writes or
// race their lastSummary assignments.
let scanQueue: Promise<void> = Promise.resolve();

function runScan(): Promise<void> {
  const gen = generation;
  scanQueue = scanQueue.then(async () => {
    if (gen !== generation || !enabled) return;
    const summary = await scanner.scan(document, () => gen !== generation);
    if (gen !== generation) return;
    lastSummary = summary;
    publishBadge();
  });
  return scanQueue;
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
    attributeFilter: ['src', 'alt', 'role', 'aria-hidden', 'width', 'height'],
  });
  await runScan();
}

function disable(): void {
  if (!enabled) return;
  enabled = false;
  generation += 1;
  observer.disconnect();
  clearTimeout(scanTimer);
  scanner.restore(document);
  lastSummary = null;
  publishBadge();
}

// Every entry point below awaits `ready` first so a message or storage event
// arriving during the async init can't race it (e.g. a SET_ENABLED(false)
// landing before the initial isHostEnabled read resolves being undone by it).
const ready: Promise<void> = (async () => {
  if (await isHostEnabled(location.host)) await enable();
  else publishBadge();
})();

browser.runtime.onMessage.addListener((message: unknown): Promise<PageReport> | undefined => {
  const request = message as ContentRequest;
  if (request?.type === 'GET_REPORT') {
    return (async () => {
      await ready;
      if (enabled && lastSummary === null) await runScan();
      return report();
    })();
  }
  if (request?.type === 'SET_ENABLED') {
    return (async () => {
      await ready;
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
    await ready;
    if (await isHostEnabled(location.host)) await enable();
    else disable();
  })();
});

// Once images finish loading their natural dimensions are known, which can
// reclassify tiny/decorative images — worth one follow-up pass.
window.addEventListener('load', () => {
  if (enabled) scheduleScan();
});
