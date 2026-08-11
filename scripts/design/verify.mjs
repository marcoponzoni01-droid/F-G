/**
 * Verify The Dossier — Version 2, exercised inside the publisher's wrapper.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = `${REPO}/.verify`;
const content = readFileSync(`${REPO}/site/index.html`, 'utf8');
mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/v2-wrapped.html`,
  '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>*,*::before,*::after{box-sizing:border-box}body{margin:0}' +
    'img,svg,video{max-width:100%;height:auto}</style></head><body>' +
    content +
    '</body></html>'
);
const FILE = `file://${OUT}/v2-wrapped.html`;

const results = [];
const check = (n, p, d = '') => {
  results.push({ n, p });
  console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`);
};

// ── Source-level: nothing of the editor runtime may survive ──────────────
check('no unexpanded {{ }} directives', !/\{\{/.test(content));
check('no sc-for / sc-if / x-dc left', !/<sc-|<x-dc|<helmet/.test(content));
check('no style-hover / style-focus attributes left', !/style-(hover|focus)=/.test(content));
check('no <script src> (React runtime dropped)', !/<script[^>]*\ssrc=/i.test(content));

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();

const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith('file://') && !u.startsWith('data:')) errs.push('EXTERNAL REQUEST: ' + u);
});

await p.goto(FILE, { waitUntil: 'networkidle' });

// ── Views ────────────────────────────────────────────────────────────────
const views = await p.locator('[data-view]').evaluateAll((els) => els.map((e) => e.dataset.view));
// Three navigable views plus the ten article pages.
check('13 views: 3 nav + 10 articles', views.length === 13,
  `${views.length}: ${views.filter((v) => !v.startsWith('/issues/') && !v.startsWith('/studies/')).join(', ')} + ${views.filter((v) => v.startsWith('/issues/') || v.split('/').length > 2).length} articles`);
const visible = () =>
  p.locator('[data-view]').evaluateAll((els) => els.filter((e) => !e.hidden).map((e) => e.dataset.view));
check('opens on the front page', (await visible()).join() === '/');

// ── Design's homepage carried over intact ────────────────────────────────
const home = p.locator('[data-view="/"]');
check(
  "Design's italic tagline is present",
  (await p.locator('header').first().innerText()).includes('From news to knowledge')
);
check(
  "Design's added hero lede survived",
  (await home.innerText()).includes('it is a')  &&
    (await home.innerText()).includes('shock')
);
const navCentred = await p.evaluate(
  () => getComputedStyle(document.querySelector('[data-nav] ul')).justifyContent
);
check('nav is centred, as Design set it', navCentred === 'center', navCentred);
const wordmark = await p.evaluate(
  () => getComputedStyle(document.querySelector('.v2-wordmark')).fontSize
);
check('wordmark is 40px on desktop', wordmark === '40px', wordmark);
check('market panel present', await home.locator('.v2-market').isVisible());
check('market panel has 5 rows', (await home.locator('.v2-market li').count()) === 5);
check('three recent cards', (await home.locator('#archive article').count()) === 3);
check('two study cards', (await home.locator('#studies article').count()) === 2);

// Design's three-tier chips must keep their tiers.
const chipColors = await home
  .locator('section:first-of-type ul li a')
  .evaluateAll((els) => els.map((e) => getComputedStyle(e).borderTopColor));
check(
  'chips keep three distinct tiers',
  new Set(chipColors).size === 3,
  `${new Set(chipColors).size} distinct: ${[...new Set(chipColors)].join(' ')}`
);

// Hover states became real CSS.
const hoverRule = await p.evaluate(() => {
  for (const sh of document.styleSheets) {
    try {
      for (const r of sh.cssRules) {
        if (r.selectorText && /:hover/.test(r.selectorText)) return r.cssText;
      }
    } catch (e) {}
  }
  return null;
});
check('hover states compiled to CSS rules', !!hoverRule, hoverRule || '');

// ── Navigation ───────────────────────────────────────────────────────────
for (const route of ['/archive', '/studies', '/']) {
  await p.click(`[data-nav] a[href="${route}"]`);
  await p.waitForTimeout(180);
  const v = await visible();
  check(`nav → ${route}`, v.length === 1 && v[0] === route, v.join());
}

// ── Archive ──────────────────────────────────────────────────────────────
await p.click('[data-nav] a[href="/archive"]');
await p.waitForTimeout(180);
const shown = () => p.locator('[data-view="/archive"] [data-rec]:visible').count();
check('archive lists all 10', (await shown()) === 10, String(await shown()));
check(
  'count says entries, not issues',
  /entries/i.test(await p.locator('[data-archive-count]').innerText()),
  await p.locator('[data-archive-count]').innerText()
);

await p.fill('#v2-q', 'Italy');
await p.waitForTimeout(220);
const n1 = await shown();
const t1 = await p.locator('[data-view="/archive"] [data-rec]:visible h3').allInnerTexts();
check('search "Italy" narrows correctly', n1 >= 1 && n1 < 10 && t1.some((t) => t.includes('Italy')),
  `${n1}: ${t1.join(' | ')}`);

await p.click('[data-view="/archive"] [data-archive-clear]');
await p.waitForTimeout(220);
check('clear restores all 10', (await shown()) === 10, String(await shown()));

// Every facet option must return at least one entry.
const facets = await p.locator('[data-view="/archive"] select[data-filter]').evaluateAll((els) =>
  els.map((e) => ({ id: e.id, opts: Array.from(e.options).map((o) => o.value).filter(Boolean) }))
);
let facetOk = true;
const bad = [];
for (const f of facets) {
  for (const v of f.opts) {
    await p.selectOption(`#${f.id}`, v);
    await p.waitForTimeout(110);
    if ((await shown()) < 1) { facetOk = false; bad.push(`${f.id}=${v}`); }
  }
  await p.selectOption(`#${f.id}`, '');
  await p.waitForTimeout(100);
}
check(
  `every facet option returns ≥1 (${facets.length} facets, ${facets.reduce((a, f) => a + f.opts.length, 0)} options)`,
  facetOk,
  bad.join(', ')
);

// Kind facet must actually separate the two collections.
await p.selectOption('#kind', 'study');
await p.waitForTimeout(200);
check('kind=study yields exactly the 2 studies', (await shown()) === 2, String(await shown()));
await p.selectOption('#kind', 'issue');
await p.waitForTimeout(200);
check('kind=issue yields exactly the 8 issues', (await shown()) === 8, String(await shown()));
await p.click('[data-view="/archive"] [data-archive-clear]');
await p.waitForTimeout(200);

// ── Studies ──────────────────────────────────────────────────────────────
await p.click('[data-nav] a[href="/studies"]');
await p.waitForTimeout(200);
const st = p.locator('[data-view="/studies"]');
check('studies shows both studies', (await st.locator('article').count()) === 2);
const groups = await st.locator('h2').allInnerTexts();
check('grouped into Countries and Mechanisms', groups.length === 2, groups.join(' / '));

// ── Out-of-scope routes ──────────────────────────────────────────────────
await p.click('[data-nav] a[href="/about"]');
await p.waitForTimeout(250);
const toast = await p.locator('.v2-toast').innerText();
check('a route outside the prototype explains itself',
  toast.toLowerCase().includes('prototype') && (await visible()).length === 1, toast);

// ── Nothing overflows its own card ───────────────────────────────────────
// The document-level overflow check cannot see this: a nowrap eyebrow wider
// than its card is clipped at the card edge, and the page never scrolls.
for (const route of ['/', '/archive', '/studies']) {
  await p.click(`[data-nav] a[href="${route}"]`);
  await p.waitForTimeout(200);
  const spills = await p.evaluate((r) => {
    const out = [];
    document.querySelectorAll(`[data-view="${r}"] article`).forEach((card) => {
      const cb = card.getBoundingClientRect();
      card.querySelectorAll('*').forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.width && b.right > cb.right + 1) {
          out.push((el.textContent || '').trim().slice(0, 40));
        }
      });
    });
    return out;
  }, route);
  check(`no card content spills its box on ${route}`, spills.length === 0,
    spills.slice(0, 3).join(' | '));
}

// ── Articles open when a card is clicked ─────────────────────────────────
const ARTICLES = [
  '/issues/2026-07-26-red-sea-reroutes',
  '/issues/2026-07-19-sanctions-designation-gap',
  '/issues/2026-07-12-substitution-clock',
  '/issues/2026-07-05-election-premium',
  '/issues/2026-06-28-storage-is-the-constraint',
  '/issues/2026-06-21-borrowed-short-invested-long',
  '/issues/2026-06-14-the-rate-that-served-the-peg',
  '/issues/2026-06-07-the-embargo-and-the-lag',
  '/studies/italy-the-debt-the-banks-and-the-spread',
  '/studies/what-a-central-bank-can-do-about-energy',
];
const allViews = await p.locator('[data-view]').evaluateAll((els) => els.map((e) => e.dataset.view));
check('all 10 article pages present', ARTICLES.every((a) => allViews.includes(a)),
  `${allViews.length} views total`);

// From the homepage: click a recent card's title.
await p.click('[data-nav] a[href="/"]');
await p.waitForTimeout(180);
await p.click('[data-view="/"] #archive article h3 a');
await p.waitForTimeout(260);
let v = await visible();
check('clicking a homepage card opens the article', v.length === 1 && v[0].startsWith('/issues/'),
  v.join());
check('the article renders its headline',
  (await p.locator(`[data-view="${v[0]}"] h1`).innerText()).length > 10,
  await p.locator(`[data-view="${v[0]}"] h1`).innerText());

// The article must be styled, not raw markup: its h1 resolves through the
// Tailwind sheet and the custom properties.
const artStyle = await p.evaluate((r) => {
  const h1 = document.querySelector(`[data-view="${r}"] h1`);
  const cs = getComputedStyle(h1);
  return { family: cs.fontFamily, size: cs.fontSize, color: cs.color };
}, v[0]);
check('article headline is serif and large', /serif|Georgia/i.test(artStyle.family) &&
  parseFloat(artStyle.size) >= 28, JSON.stringify(artStyle));

// No nav item may claim to be current while an article is open — none of the
// three nav routes is the page you are on.
const navState = await p.evaluate(() =>
  Array.from(document.querySelectorAll('[data-nav] a')).map((a) => ({
    href: a.getAttribute('href'), current: a.getAttribute('aria-current'),
  })));
check('no nav item is falsely marked current on an article',
  navState.every((n) => !n.current),
  navState.filter((n) => n.current).map((n) => n.href).join(', '));

// From the archive: click a study card.
await p.click('[data-nav] a[href="/archive"]');
await p.waitForTimeout(200);
await p.click('[data-view="/archive"] [data-rec="italy-the-debt-the-banks-and-the-spread"] h3 a');
await p.waitForTimeout(260);
v = await visible();
check('clicking an archive card opens the study',
  v.join() === '/studies/italy-the-debt-the-banks-and-the-spread', v.join());

// From the studies page.
await p.click('[data-nav] a[href="/studies"]');
await p.waitForTimeout(200);
await p.click('[data-view="/studies"] article h3 a');
await p.waitForTimeout(260);
v = await visible();
check('clicking a studies card opens the study', v.length === 1 && v[0].startsWith('/studies/'),
  v.join());

// Every article reachable and non-empty.
let emptyArticles = [];
for (const route of ARTICLES) {
  const txt = await p.locator(`[data-view="${route}"]`).evaluate((el) => el.textContent.trim().length);
  if (txt < 500) emptyArticles.push(route);
}
check('every article page has substantial content', emptyArticles.length === 0,
  emptyArticles.join(', '));

// Charts survived the move.
const charts = await p.locator('[data-view^="/issues/"] .issue-chart svg, [data-view^="/studies/"] .issue-chart svg').count();
check('article charts render as SVG', charts >= 8, `${charts} charts`);

// A chip on an article deep-links into a filtered archive.
await p.click('[data-nav] a[href="/"]');
await p.waitForTimeout(160);
await p.click('[data-view="/"] #archive article h3 a');
await p.waitForTimeout(240);
const cur = (await visible())[0];
const chip = p.locator(`[data-view="${cur}"] a[href*="/archive?"]`).first();
const chipHref = await chip.getAttribute('href');
await chip.click();
await p.waitForTimeout(300);
const afterChip = await shown();
check('an article chip lands on a filtered archive',
  (await visible()).join() === '/archive' && afterChip > 0 && afterChip < 10,
  `${chipHref} → ${afterChip} of 10`);
await p.click('[data-view="/archive"] [data-archive-clear]');
await p.waitForTimeout(200);

// ── Dark is forced: no light-mode leak into the article pages ─────────────
{
  const lightCtx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const lp = await lightCtx.newPage();
  await lp.goto(FILE, { waitUntil: 'networkidle' });
  const paper = await lp.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
  check('--paper stays dark under a light OS preference', paper === '#0b0d10', paper);
  await lightCtx.close();
}

// Design's pages being untouched by the article stylesheets is proved by
// regress-design.mjs, which builds the artifact with and without the article
// layer and pixel-diffs the three views she owns. It lives apart because it
// needs two builds, not two screenshots.

// ── Hygiene ──────────────────────────────────────────────────────────────
const dupes = await p.evaluate(() => {
  const seen = {};
  document.querySelectorAll('[id]').forEach((e) => { seen[e.id] = (seen[e.id] || 0) + 1; });
  return Object.entries(seen).filter(([, n]) => n > 1);
});
check('no duplicate ids', dupes.length === 0, dupes.map(([k, n]) => `${k}x${n}`).join(', '));

// ── Overflow + screenshots ───────────────────────────────────────────────
for (const [w, h, tag] of [[1440, 1000, 'desktop'], [768, 900, 'tablet'], [375, 780, 'mobile']]) {
  await p.setViewportSize({ width: w, height: h });
  // Article pages carry a sidebar and charts, so they are checked too.
  const routes = ['/', '/archive', '/studies',
                  '/issues/2026-07-26-red-sea-reroutes',
                  '/studies/italy-the-debt-the-banks-and-the-spread'];
  for (const route of routes) {
    const nav = route.split('/').length > 2
      ? null : `[data-nav] a[href="${route}"]`;
    if (nav) await p.click(nav);
    else await p.evaluate((r) => {
      document.querySelectorAll('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== r; });
    }, route);
    await p.waitForTimeout(280);
    const over = await p.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check(`no h-overflow ${tag} ${route}`, over <= 0, `${over}px`);
    const name = route === '/' ? 'home' : route.replace(/\//g, '-').replace(/^-/, '');
    if (tag !== 'tablet') {
      await p.screenshot({ path: `${OUT}/v2-${tag}-${name}.png`, fullPage: tag === 'desktop' });
    }
  }
}

check('no page errors or external requests', errs.length === 0, errs.slice(0, 6).join(' | '));

await b.close();
const failed = results.filter((r) => !r.p);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILED:\n' + failed.map((f) => '  ' + f.n).join('\n'));
  process.exit(1);
}
