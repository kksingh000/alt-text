import browser from 'webextension-polyfill';
import type { Runtime } from 'webextension-polyfill';
import { countIssues } from '@alt-text/scorer';
import type { BadgeReport } from '../shared/messages';

void browser.action.setBadgeBackgroundColor({ color: '#8C1D18' });
// Not implemented on every browser; badge stays readable either way.
void browser.action.setBadgeTextColor?.({ color: '#FFFFFF' })?.catch?.(() => {});

// Issue counts per (tab, frame): content scripts run in every frame, so the
// badge shows the whole tab's total. Rebuilt lazily from incoming reports if
// the service worker restarts (badge text itself survives SW death).
const tabFrameIssues = new Map<number, Map<number, number>>();

function badgeText(tabId: number): string {
  let issues = 0;
  for (const n of tabFrameIssues.get(tabId)?.values() ?? []) issues += n;
  return issues === 0 ? '' : issues > 99 ? '99+' : String(issues);
}

browser.runtime.onMessage.addListener((message: unknown, sender: Runtime.MessageSender) => {
  const report = message as BadgeReport;
  if (report?.type !== 'REPORT') return undefined;
  const tabId = sender.tab?.id;
  if (tabId === undefined) return undefined;

  const issues = report.enabled && report.counts ? countIssues(report.counts) : 0;
  const frames = tabFrameIssues.get(tabId) ?? new Map<number, number>();
  frames.set(sender.frameId ?? 0, issues);
  tabFrameIssues.set(tabId, frames);
  void browser.action.setBadgeText({ tabId, text: badgeText(tabId) }).catch(() => {});
  return undefined;
});

// A navigation invalidates every frame's counts (the browser also clears the
// tab's badge on its own).
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') tabFrameIssues.delete(tabId);
});

browser.tabs.onRemoved.addListener((tabId) => {
  tabFrameIssues.delete(tabId);
});
