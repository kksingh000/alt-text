#!/usr/bin/env node
// Regenerates the per-language copies of the canonical rule spec.
// Canonical file:  packages/scorer/spec/scorer.spec.json  (edit this one)
// Generated files: ts/src/spec.data.ts, python/alt_text_scorer/spec_data.json
// Both test suites fail if a generated copy drifts from the canonical spec.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPath = join(root, 'spec', 'scorer.spec.json');
const spec = JSON.parse(readFileSync(canonicalPath, 'utf8'));
const pretty = JSON.stringify(spec, null, 2);

const tsHeader =
  '// AUTO-GENERATED from packages/scorer/spec/scorer.spec.json — do not edit.\n' +
  '// Regenerate with: node packages/scorer/scripts/sync-spec.mjs\n' +
  "import type { ScorerSpec } from './types.js';\n\n";
writeFileSync(join(root, 'ts', 'src', 'spec.data.ts'), `${tsHeader}export const SPEC: ScorerSpec = ${pretty};\n`);

writeFileSync(join(root, 'python', 'alt_text_scorer', 'spec_data.json'), `${pretty}\n`);

console.log('Spec synced to ts/src/spec.data.ts and python/alt_text_scorer/spec_data.json');
