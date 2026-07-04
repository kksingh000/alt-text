#!/usr/bin/env node
// Builds the extension for Chrome/Edge (default) or Firefox (--target=firefox).
// The Firefox port is exactly the config change below: MV3 event-page background
// instead of a service worker, plus the required gecko add-on id.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = process.argv.includes('--target=firefox') ? 'firefox' : 'chrome';
const outdir = join(here, 'dist', target);
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

await esbuild.build({
  absWorkingDir: here,
  entryPoints: {
    content: 'src/content/index.ts',
    background: 'src/background/index.ts',
    popup: 'src/popup/main.tsx',
  },
  bundle: true,
  format: 'iife',
  outdir,
  alias: {
    // Bundle the scorer straight from source so the extension never depends
    // on a stale packages/scorer/ts/dist build.
    '@alt-text/scorer': resolve(here, '../packages/scorer/ts/src/index.ts'),
  },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  target: ['chrome120', 'firefox121'],
  minify: true,
  logLevel: 'info',
});

const manifest = {
  manifest_version: 3,
  name: 'Alt Text Guardian',
  version: pkg.version,
  description:
    'Flags images with missing or meaningless alt text and gives screen reader users a useful announcement instead of silence or filename garbage.',
  permissions: ['storage', 'activeTab'],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['content.js'],
      run_at: 'document_idle',
    },
  ],
  background:
    target === 'firefox'
      ? { scripts: ['background.js'] }
      : { service_worker: 'background.js' },
  action: {
    default_popup: 'popup.html',
    default_title: 'Alt Text Guardian',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
    },
  },
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  ...(target === 'firefox' && {
    browser_specific_settings: {
      gecko: { id: 'alt-text-guardian@kksingh.dev', strict_min_version: '121.0' },
    },
  }),
};

writeFileSync(join(outdir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
cpSync(join(here, 'src', 'popup', 'popup.html'), join(outdir, 'popup.html'));
cpSync(join(here, 'public', 'icons'), join(outdir, 'icons'), { recursive: true });

console.log(`Built ${target} extension → ${outdir}`);
