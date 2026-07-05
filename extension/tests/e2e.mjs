#!/usr/bin/env node
// End-to-end check: loads the built Chrome extension into real Chromium via
// Playwright, serves the fixture page over localhost, and asserts the content
// script injected/withheld alt text correctly. Run: npm run test:e2e
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const extensionPath = join(here, '..', 'dist', 'chrome');
assert.ok(existsSync(join(extensionPath, 'manifest.json')), 'run `npm run build` first');

const fixture = readFileSync(join(here, 'fixtures', 'page.html'));
const frameHtml = '<!DOCTYPE html><html lang="en"><body><img id="frame-missing" src="/f.jpg"></body></html>';
const server = createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('content-type', 'text/html');
    res.end(fixture);
  } else if (req.url === '/frame') {
    res.setHeader('content-type', 'text/html');
    res.end(frameHtml);
  } else {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

// Extensions need the FULL Chromium build: plain `headless: true` runs the
// "chromium headless shell", which silently ignores --load-extension. Use the
// sandbox's preinstalled full build when present, otherwise Playwright's full
// build via channel 'chromium' (its documented path for headless extensions).
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const context = await chromium.launchPersistentContext('', {
  headless: true,
  ...(executablePath ? { executablePath } : { channel: 'chromium' }),
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('img[data-altguard]', { timeout: 10_000 });

  assert.equal(
    await page.getAttribute('#missing', 'alt'),
    'Image, no description available',
    'missing alt gets the fallback announcement',
  );
  assert.equal(
    await page.getAttribute('#generic', 'alt'),
    'Image, description may be unreliable: img_1234',
    'generic alt gets a warning prefix and keeps the original',
  );
  assert.equal(
    await page.getAttribute('#good', 'alt'),
    'A tabby cat sleeping on a windowsill',
    'good alt is untouched',
  );
  assert.equal(
    await page.getAttribute('#spacer', 'data-altguard'),
    null,
    'unmarked-decorative images are reported but never rewritten',
  );
  assert.equal(
    await page.getAttribute('#spacer', 'alt'),
    null,
    'spacer alt attribute stays absent',
  );
  // Images inside iframes are scanned too (all_frames: true).
  const frame = page.frameLocator('#embed');
  await frame.locator('img[data-altguard]').waitFor({ timeout: 10_000 });
  assert.equal(
    await frame.locator('#frame-missing').getAttribute('alt'),
    'Image, no description available',
    'missing alt inside an iframe gets the fallback announcement',
  );

  console.log('e2e OK: content script scored and annotated the fixture page (incl. iframe)');

  // --- options page + live settings sync ---
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.waitForSelector('.empty');

  // Disabling the fixture host (as the popup toggle would) must appear in the
  // options list AND live-restore the already-open page.
  const host = `127.0.0.1:${port}`;
  await options.evaluate(
    (h) => chrome.storage.local.set({ disabledHosts: [h] }),
    host,
  );
  await options.waitForSelector('.host-list li');
  assert.equal(await options.textContent('.host-list .host'), host, 'disabled host listed');
  await page.waitForSelector('img[data-altguard]', { state: 'detached', timeout: 5000 });
  assert.equal(
    await page.getAttribute('#missing', 'alt'),
    null,
    'original (absent) alt restored when scanning is disabled remotely',
  );
  assert.equal(
    await page.getAttribute('#generic', 'alt'),
    'img_1234',
    'original generic alt restored when scanning is disabled remotely',
  );

  // Re-enabling from the options page re-annotates the open tab.
  await options.click('.host-list button');
  await options.waitForSelector('.empty');
  await page.waitForSelector('img[data-altguard]', { timeout: 5000 });
  assert.equal(
    await page.getAttribute('#missing', 'alt'),
    'Image, no description available',
    're-enabling from options re-annotates open tabs',
  );

  console.log('e2e OK: options page manages the disabled-site list with live sync');
} finally {
  await context.close();
  server.close();
}
