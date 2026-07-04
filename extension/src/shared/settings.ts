import browser from 'webextension-polyfill';

const KEY = 'disabledHosts';

async function getDisabledHosts(): Promise<string[]> {
  const stored = await browser.storage.local.get(KEY);
  const value = stored[KEY];
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
  await browser.storage.local.set({ [KEY]: [...hosts] });
}
