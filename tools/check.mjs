#!/usr/bin/env node
// Browser-free sanity check for the single-file app (index.html).
// Validates that the inline <script> parses and that key anchors exist.
// Run: npm run check
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const fail = (msg) => { console.error('✗ ' + msg); process.exitCode = 1; };
const ok = (msg) => console.log('✓ ' + msg);

// 1) Every inline <script> block must parse as JS (catches unterminated
//    strings, stray braces, etc. without executing anything).
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (!scripts.length) fail('no inline <script> blocks found');
scripts.forEach((code, i) => {
  try { new Function(code); ok(`script block #${i + 1} parses`); }
  catch (e) { fail(`script block #${i + 1} syntax error: ${e.message}`); }
});

// 2) Key structural anchors the app relies on.
const anchors = [
  ['<div id="app"', 'app mount point'],
  ['function render(', 'render() entry'],
  ['function renderLibrary(', 'library view'],
  ['manifest.webmanifest', 'PWA manifest link'],
];
for (const [needle, label] of anchors) {
  if (html.includes(needle)) ok(`${label} present`);
  else fail(`${label} missing ("${needle}")`);
}

console.log(process.exitCode ? '\nCHECK FAILED' : '\nCHECK PASSED');
