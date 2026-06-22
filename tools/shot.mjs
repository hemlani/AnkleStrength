#!/usr/bin/env node
// Screenshot the app at a phone viewport so UI changes can be eyeballed.
//
//   npm run shot                 # all tabs -> screenshots/<view>.png
//   npm run shot -- library home # just these tabs
//   FULL=1 npm run shot          # also capture full-page (whole scroll) shots
//
// Requires a Chromium build. If it's missing, this prints how to get one.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'screenshots');
mkdirSync(outDir, { recursive: true });

const VIEWS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['home', 'library', 'history', 'progress', 'settings'];
const FULL = process.env.FULL === '1';

// Demo data so History/Progress aren't empty when we shoot them.
const seed = {
  showup_settings: { onboarded: true, weeklyGoal: 3, trainingDays: [1, 3, 5], activeRoutineId: 'showup' },
  showup_sessions: [
    { id: 's1', date: '2026-06-16', routineId: 'showup', startedAt: 1, endedAt: 2, durationSec: 1500,
      completedExercises: [{ exerciseId: 'su-glute-bridge', setsDone: 2, weight: '40 lb', reps: '12', notes: '' },
                           { exerciseId: 'su-calf-raise', setsDone: 3, weight: '', reps: '15', notes: '' }],
      wasEasyDay: false, notes: 'Felt strong.' },
    { id: 's2', date: '2026-06-19', routineId: 'showup', startedAt: 1, endedAt: 2, durationSec: 1100,
      completedExercises: [{ exerciseId: 'su-glute-bridge', setsDone: 2, weight: '45 lb', reps: '12', notes: '' }],
      wasEasyDay: true, notes: '' },
  ],
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  try {
    const url = (req.url || '/').split('?')[0];
    const file = join(root, url === '/' ? 'index.html' : decodeURIComponent(url));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});

await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  console.error('Playwright is not installed. Run: npm install'); process.exit(1);
}

let browser;
try {
  browser = await chromium.launch();
} catch (e) {
  console.error('\nCould not launch Chromium:\n  ' + e.message.split('\n')[0]);
  console.error('\nThe browser binary is missing. Install it with:');
  console.error('  npx playwright install chromium');
  console.error('\nIf that fails with a 403 / "Host not in allowlist", add this host to');
  console.error('your environment\'s network egress allowlist, then retry:');
  console.error('  cdn.playwright.dev');
  await server.close();
  process.exit(1);
}

const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
});
await ctx.addInitScript((data) => {
  for (const k in data) localStorage.setItem(k, JSON.stringify(data[k]));
}, seed);

const page = await ctx.newPage();
await page.goto(base + '/index.html', { waitUntil: 'networkidle' });

for (const view of VIEWS) {
  await page.evaluate((v) => window.A && window.A.nav(v), view);
  await page.waitForTimeout(250); // let charts/animations settle
  await page.screenshot({ path: join(outDir, `${view}.png`) });
  console.log(`✓ screenshots/${view}.png`);

  if (FULL) {
    // Relax the viewport-locked shell so the whole scroll height is captured.
    await page.addStyleTag({ content:
      'html,body{height:auto!important;overflow:visible!important}' +
      '#app{height:auto!important;overflow:visible!important}' +
      '.main{overflow:visible!important;min-height:0!important}' });
    await page.waitForTimeout(80);
    await page.screenshot({ path: join(outDir, `${view}-full.png`), fullPage: true });
    console.log(`✓ screenshots/${view}-full.png`);
    await page.reload({ waitUntil: 'networkidle' }); // restore shell for next view
  }
}

await browser.close();
await new Promise((r) => server.close(r));
console.log(`\nDone — ${VIEWS.length} view(s) in screenshots/`);
