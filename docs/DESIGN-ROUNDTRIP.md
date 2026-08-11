# Working on the site with Claude Code and Claude Design

`site/index.html` is the site. One file, one copy, versioned here. Claude Code
changes structure and content; Claude Design changes how it looks; the two
accumulate instead of overwriting each other.

## The loop

```
# 1. Structure and content — Claude Code
#    Edit site/index.html directly, or regenerate it from source:
python3 scripts/design/build_site.py
node scripts/design/verify.mjs
git commit -am "..." && git push

# 2. Looks — Claude Design
#    Upload site/index.html. Restyle. Download what comes back.

# 3. Back in — Claude Code
python3 scripts/design/import_from_design.py <file> --dry-run   # see the effect first
python3 scripts/design/import_from_design.py <file>
node scripts/design/verify.mjs
node scripts/design/check-nojs.mjs
git commit -am "..." && git push
```

Step 3 merges per view. Anything Code changed that Design did not touch stays;
anything Design restyled comes in. That is what makes the changes add up.

## The three rules Design must respect

They are written into the top of `site/index.html` as a comment, so they travel
with the file:

1. **Keep every `data-part`.** These mark the components — `masthead`, `hero`,
   `market-panel`, `card-issue`, `card-study`, `chip-type`, `chip-region`,
   `chip-asset`, `facets`, `newsletter`, `footer`.
2. **Keep every `data-view` and its value.** These are the 13 pages. Rename one
   and that page is lost from the merge.
3. **Keep the `href` values.** Navigation runs on them.

Everything else — colour, type, spacing, layout — is open.

The importer matches on these attributes rather than on document position, so
Design can move, reorder and rewrite freely and the merge still lands. If a
returned view has lost hooks, the import still runs but warns: the merge works
this time, the *next* round trip would not.

## Why every page is visible at once

All 13 views sit in the document with no `hidden` attribute. The router hides
all but the current one as soon as it runs. Same file, two behaviours: readable
top to bottom without JavaScript, a working site with it.

This is not cosmetic. The first hand-off kept 12 of 13 views hidden and revealed
them by script; Design, not running that script, saw a blank page and rebuilt
from guesswork — one page came back out of three. `scripts/design/check-nojs.mjs`
fails the build if that regresses.

## What Design's export looks like

Not the same file that went out. Their editor exports a self-extracting bundle:
React and a `dc-runtime` gzipped into a `__bundler/manifest` island, the real
markup as a JSON string in `__bundler/template`, and runtime directives in the
markup (`sc-for`, `sc-if`, `{{ }}`, `style-hover`, `style-focus`). None of it
runs outside their editor.

`import_from_design.py` handles all of it: unwraps bundle or plain HTML,
resolves the directives, converts `style-hover`/`style-focus` into real CSS
rules, then merges.

## What the build always re-applies

Design's work consistently arrives without these, so the builder puts them back
every time:

| Layer | Why |
|---|---|
| Responsive | The sketch had no media query at all — fixed 3-column grids, a 384px block. Design's desktop layout is untouched above 900px. |
| `:focus-visible` | Hover was styled, keyboard focus was not. |
| Forced dark | Design is dark-only with literal hex. Without pinning, an article opens cream inside a near-black shell on a light-preference machine. |
| Scoped article CSS | The article pages are Tailwind; its preflight is a global reset. Unscoped it retypesets Design's pages — measured: nav line-height to 19.5px, front page 107px taller. |

## Checks

| Command | Checks | In CI |
|---|---|---|
| `npm run check:site` | views present and none hidden, hooks intact, banner rules, no external loads, index parses | yes |
| `npm run check:roundtrip` | no-op import is byte identical; a 1-of-13 return keeps the other 12 | yes |
| `node scripts/design/check-nojs.mjs` | the same no-JS property, in a real browser | no |
| `node scripts/design/verify.mjs` | 60 checks: routing, search, facets, articles, overflow at three widths | no |

The two in CI need no browser and add about a second. The browser-driven pair
stay local — run them after an import, before pushing.

The invariants worth knowing about, because each one fails *silently*:

- **No view ships `hidden`.** The regression with history: hide the views and
  reveal them by script, and anything that does not run scripts sees a blank
  document. That is how a hand-off came back missing twelve of thirteen pages.
- **Hooks intact.** `data-part` and `data-view` are what the merge matches on.
  Lose them and the next round trip has nothing to land against.
- **Banner rules present.** They are the only thing telling Design what not to
  touch, and they travel inside the file.
- **Search index parses.** When it does not, the archive shows everything —
  which looks like it worked.

Anchor `href`s are not treated as external references. The article sidebars
cite IMF PortWatch and UNCTAD; a citation pointing at the open web is correct.
Only `src` attributes and `<link href>` count as loads.

## Sources

`design/sources/` holds the inputs `build_site.py` assembles from, vendored so
the build never depends on a temporary folder. `design/incoming/` archives each
file Design returns.

## A note on size

`site/index.html` is ~323 KB, of which roughly 63% is article prose and the
search index — content Design never looks at. It stays whole because it is the
only copy. If Design ever struggles with the size, add a reduced export
alongside it; do not trim the canonical file.
