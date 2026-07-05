#!/usr/bin/env node
// Builds both targets and zips them for store submission:
//   dist/alt-text-guardian-chrome-v<version>.zip   (Chrome Web Store / Edge Add-ons)
//   dist/alt-text-guardian-firefox-v<version>.zip  (Firefox Add-ons)
// Requires the `zip` CLI (preinstalled on macOS/Linux; CI uses ubuntu).
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));

for (const target of ['chrome', 'firefox']) {
  const args = target === 'firefox' ? ['build.mjs', '--target=firefox'] : ['build.mjs'];
  execFileSync('node', args, { cwd: here, stdio: 'inherit' });

  const zipName = `alt-text-guardian-${target}-v${version}.zip`;
  const zipPath = join(here, 'dist', zipName);
  rmSync(zipPath, { force: true });
  execFileSync('zip', ['-r', zipPath, '.'], { cwd: join(here, 'dist', target), stdio: 'pipe' });
  console.log(`Packaged dist/${zipName}`);
}
