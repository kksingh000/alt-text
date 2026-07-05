import browser from 'webextension-polyfill';

export const DISABLED_HOSTS_KEY = 'disabledHosts';

export async function getDisabledHosts(): Promise<string[]> {
  const stored = await browser.storage.local.get(DISABLED_HOSTS_KEY);
  const value = stored[DISABLED_HOSTS_KEY];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Scanning is on by default; users opt individual sites out. */
export async function isHostEnabled(host: string): Promise<boolean> {
  return !(await getDisabledHosts()).includes(host);
}

export async function setHostEnabled(host: string, enabled: boolean): Promise<void> {
  const hosts = new Set(await getDisabledHosts());
  if (enabled) hosts.delete(host);
  else hosts.add(host);
  await browser.storage.local.set({ [DISABLED_HOSTS_KEY]: [...hosts] });
}

export async function clearDisabledHosts(): Promise<void> {
  await browser.storage.local.set({ [DISABLED_HOSTS_KEY]: [] });
}
