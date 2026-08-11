/**
 * The check that prevents the failure that started all this.
 *
 * site/index.html ships every view visible, with the router hiding all but one
 * once it runs. That is what lets a tool which does not execute scripts — an
 * editor importing the file, a preview pane, a crawler — read the whole site
 * instead of a blank page. The first hand-off to Design had `hidden` in the
 * markup and the reveal in JavaScript; one page out of three came back.
 *
 * Fails if any view is invisible without JavaScript, or if exactly one is not
 * visible with it.
 */
import { chromium } from 'playwright';

const FILE = 'file://' + new URL('../../site/index.html', import.meta.url).pathname;
const EXPECTED_PARTS = [
  'card-issue', 'card-study', 'chip-asset', 'chip-region', 'chip-type',
  'facets', 'footer', 'hero', 'market-panel', 'masthead', 'newsletter',
];

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
let bad = 0;
const say = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) bad++; };

// Without scripts: everything readable.
{
  const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(FILE, { waitUntil: 'load' });
  const total = await p.$$eval('[data-view]', (e) => e.length);
  const vis = await p.$$eval('[data-view]', (e) => e.filter((x) => x.getClientRects().length > 0).length);
  const parts = await p.$$eval('[data-part]', (e) => [...new Set(e.map((x) => x.dataset.part))].sort());
  const h = await p.evaluate(() => document.body.scrollHeight);

  say(total === 13, `13 views in the document — got ${total}`);
  say(vis === total, `every view readable without JavaScript — ${vis}/${total} visible`);
  say(h > 5000, `document has real height without JavaScript — ${h}px`);
  const miss = EXPECTED_PARTS.filter((x) => !parts.includes(x));
  say(miss.length === 0, `every data-part hook present — missing: ${miss.join(', ') || 'none'}`);
  await ctx.close();
}

// With scripts: a working site, one view at a time.
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(FILE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const vis = await p.$$eval('[data-view]', (e) => e.filter((x) => !x.hidden).map((x) => x.dataset.view));
  say(vis.length === 1 && vis[0] === '/', `router shows one view with JavaScript — ${vis.join(', ')}`);
  await ctx.close();
}

await b.close();
console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
