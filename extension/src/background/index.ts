import browser from 'webextension-polyfill';
import type { Runtime } from 'webextension-polyfill';
import { countIssues } from '@alt-text/scorer';
import type { BadgeReport } from '../shared/messages';

void browser.action.setBadgeBackgroundColor({ color: '#8C1D18' });
// Not implemented on every browser; badge stays readable either way.
void browser.action.setBadgeTextColor?.({ color: '#FFFFFF' })?.catch?.(() => {});

browser.runtime.onMessage.addListener((message: unknown, sender: Runtime.MessageSender) => {
  const report = message as BadgeReport;
  if (report?.type !== 'REPORT') return undefined;
  const tabId = sender.tab?.id;
  if (tabId === undefined) return undefined;

  const issues = report.enabled && report.counts ? countIssues(report.counts) : 0;
  const text = issues === 0 ? '' : issues > 99 ? '99+' : String(issues);
  void browser.action.setBadgeText({ tabId, text }).catch(() => {});
  return undefined;
});
