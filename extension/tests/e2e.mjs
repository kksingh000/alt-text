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
const server = createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('content-type', 'text/html');
    res.end(fixture);
  } else {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

// The sandbox pre-installs a full Chromium; fall back to it if the npm
// playwright version doesn't match the installed browser build.
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const context = await chromium.launchPersistentContext('', {
  headless: true,
  executablePath,
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

  console.log('e2e OK: content script scored and annotated the fixture page in real Chromium');
} finally {
  await context.close();
  server.close();
}
