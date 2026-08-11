/**
 * Static invariants for site/index.html. No browser, no dependencies.
 *
 * The full checks (check-nojs.mjs, verify.mjs) drive a real browser and are too
 * heavy for every push. These are the properties whose failure is silent — the
 * page still looks right, so nothing tells you — and every one of them is
 * detectable by reading the file.
 *
 * The first is the one that cost twelve views: hand Design a file whose views
 * are `hidden` and revealed by script, and a tool that does not run scripts
 * sees an empty document and rebuilds from guesswork.
 */
import { readFileSync } from 'node:fs';

const FILE = new URL('../../site/index.html', import.meta.url).pathname;
const html = readFileSync(FILE, 'utf8');

const EXPECTED_VIEWS = 13;
const EXPECTED_PARTS = [
  'masthead', 'hero', 'market-panel', 'newsletter', 'footer',
  'card-issue', 'card-study', 'chip-type', 'chip-region', 'chip-asset', 'facets',
];

let bad = 0;
const check = (ok, name, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) bad++;
};

// 1. Every view present, and none of them hidden in the markup.
const opens = [...html.matchAll(/<section[^>]*\sdata-view="([^"]+)"[^>]*>/g)];
check(opens.length === EXPECTED_VIEWS, `${EXPECTED_VIEWS} views present`, `found ${opens.length}`);

const hidden = opens.filter((m) => /\shidden(?=[\s>])/.test(m[0])).map((m) => m[1]);
check(
  hidden.length === 0,
  'no view ships hidden (readable without JavaScript)',
  hidden.length ? `${hidden.length} hidden: ${hidden.slice(0, 3).join(', ')}` : ''
);

// 2. The hooks the importer matches on.
const parts = new Set([...html.matchAll(/data-part="([^"]+)"/g)].map((m) => m[1]));
const missingParts = EXPECTED_PARTS.filter((p) => !parts.has(p));
check(missingParts.length === 0, 'every data-part hook present', missingParts.join(', '));

// 3. The rules travel with the file, or Design never sees them.
for (const rule of ['data-part', 'data-view', 'href']) {
  check(
    new RegExp(`KEEP[^\\n]*${rule}`).test(html),
    `hand-off banner states the ${rule} rule`
  );
}

// 4. Self-contained: an artifact runs under a CSP that blocks every external
//    host, and the local copy has to work offline.
//
//    Only resource LOADS count — src on any element, href on <link>. Anchor
//    hrefs are not loads: the article sidebars cite IMF PortWatch and UNCTAD,
//    and a citation pointing at the open web is correct, not a violation.
const ext = [
  ...html.matchAll(/\ssrc="(?:https?:)?\/\/[^"]+"/g),
  ...html.matchAll(/<link[^>]+href="(?:https?:)?\/\/[^"]+"/g),
].map((m) => m[0].trim());
check(ext.length === 0, 'no external resource loads', ext.slice(0, 2).join(', '));
check(!/<script[^>]*\ssrc=/.test(html), 'no external script tags');

// 5. The search index has to parse; the archive degrades to showing everything
//    when it does not, which looks like success.
const idx = html.match(/<script type="application\/json" id="v2-index">([\s\S]*?)<\/script>/);
if (!idx) {
  check(false, 'search index present');
} else {
  let n = 0, ok = true;
  try { n = JSON.parse(idx[1]).length; } catch { ok = false; }
  check(ok, 'search index parses as JSON');
  check(n === 10, 'search index holds 10 records', String(n));
}

console.log(bad ? `\n${bad} invariant(s) broken` : '\nall invariants hold');
process.exit(bad ? 1 : 0);
