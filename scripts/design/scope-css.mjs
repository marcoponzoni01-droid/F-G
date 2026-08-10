/**
 * Confine the article stylesheet to the article pages.
 *
 * The issue and study pages are Tailwind markup, so they need the compiled
 * sheet — which opens with Tailwind's preflight: a global reset that sets
 * `line-height: 1.5` on the root, zeroes every margin, and strips list
 * styling. Design's pages are inline-styled and assume the browser defaults,
 * so dropping that sheet in unscoped silently retypesets their whole site
 * (their nav went from a `normal` line-height to 19.5px, and the front page
 * grew 107px).
 *
 * Every selector is therefore rewritten to sit under a scope class. This is
 * done with a real parser rather than a regex: the sheet is minified and full
 * of @layer, @supports, @media and @property blocks, and selector lists like
 * `*,:before,:after,::backdrop` are exactly where a regex quietly mangles
 * things.
 *
 * Usage:  node scope-css.mjs <in> <out> <scope-selector>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import postcss from 'postcss';

const [, , inPath, outPath, SCOPE] = process.argv;
if (!inPath || !outPath || !SCOPE) {
  console.error('usage: node scope-css.mjs <in> <out> <scope>');
  process.exit(1);
}

const root = postcss.parse(readFileSync(inPath, 'utf8'));

// Design's work is dark only. The sheet ships a light palette behind a
// prefers-color-scheme query; left in, an article would open cream inside a
// near-black shell for any reader whose system prefers light. Removing it
// here is more reliable than trying to out-specify it: once the tokens are
// scoped, a scoped light rule sets them on the very element the dark rule
// targets, and the nearer declaration wins over source order.
let droppedLight = 0;
root.walkAtRules('media', (at) => {
  if (/prefers-color-scheme\s*:\s*light/.test(at.params)) {
    at.remove();
    droppedLight += 1;
  }
});

// Root-ish selectors become the scope element itself; everything else is
// nested under it. Keyframe steps (`from`, `0%`) are not selectors and must
// be left exactly as they are.
const ROOTISH = new Set([':root', 'html', ':host', 'body', '*']);

let rewritten = 0;
root.walkRules((rule) => {
  for (let p = rule.parent; p; p = p.parent) {
    if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return;
  }

  rule.selectors = rule.selectors.map((raw) => {
    const sel = raw.trim();
    if (!sel) return raw;

    // `*` and the bare root selectors: the scope element carries the
    // declarations, and its descendants get them via the `*` form below.
    if (ROOTISH.has(sel)) return SCOPE;

    // Leading pseudo-elements/classes that would otherwise attach to nothing
    // (`:before`, `::backdrop`, `::selection`, `:focus-visible`, …) apply to
    // the scope's descendants.
    if (sel.startsWith(':')) return `${SCOPE} *${sel}`;

    return `${SCOPE} ${sel}`;
  });
  rewritten += 1;
});

const out = root.toString();
writeFileSync(outPath, out);
console.error(
  `scope-css: ${rewritten} rules scoped to ${SCOPE}, ` +
    `${droppedLight} light-mode media block(s) dropped`
);
