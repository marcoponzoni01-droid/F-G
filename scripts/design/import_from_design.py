#!/usr/bin/env python3
"""
Bring a restyled copy back from Claude Design into site/index.html.

The file handed out and the file that comes back are not the same shape.
Design works in a live editor and exports a self-extracting bundle: React and
a `dc-runtime` gzipped into a `__bundler/manifest` island, the real markup in
`__bundler/template` as a JSON string, and directives in the markup itself —
`sc-for`, `sc-if`, `{{ }}`, `style-hover`, `style-focus`. None of that renders
anywhere except inside their editor, so it has to be compiled back to plain
HTML before it can be the site again.

This script is the normaliser. Whatever comes back — bundle or plain HTML — it
returns the canonical form: one self-contained file, all views visible in the
markup, router and search restored, responsive and focus layers re-applied.

    normalise(design(normalise(x)))  ==  normalise(x)   for anything untouched

Two rules make the round trip safe.

MERGE, NOT REPLACE. Design returns what it worked on, which may be one page out
of thirteen — that is exactly what happened the first time. Views that do not
come back keep the copy already in site/index.html. A partial return can never
delete the rest of the site.

MATCH ON HOOKS, NOT POSITION. Components are found by data-part and views by
data-view. Design can move, reorder or rewrite anything; as long as the
attribute survives, the merge still lands.

Usage:
    python3 scripts/design/import_from_design.py <file-from-design> [--dry-run]
"""

from pathlib import Path
import argparse
import json
import re
import sys

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SITE = REPO / 'site/index.html'
INCOMING = REPO / 'design/incoming'

sys.path.insert(0, str(HERE))


def die(msg):
    sys.exit(f'import: {msg}')


# ── Recognise what came back ──────────────────────────────────────────────
def unwrap(html):
    """
    Get plain HTML out of whatever Design exported.

    A bundle keeps the markup in a JSON string inside `__bundler/template`; the
    manifest beside it is React and the editor runtime, which are of no use
    outside the editor and are dropped. A plain HTML export is returned as-is.
    """
    m = re.search(r'<script type="__bundler/template">([\s\S]*?)</script>', html)
    if m:
        return json.loads(m.group(1)), 'bundle'
    if '<x-dc>' in html:
        return html, 'template'
    return html, 'plain'


def compile_directives(html):
    """
    Resolve the editor's template directives to static markup.

    `sc-for` / `sc-if` only mean something to the runtime. When Design restyles
    an existing document it normally leaves the expanded markup alone, so these
    are usually absent — but a component rebuilt in their editor can reintroduce
    them, and unresolved they would ship as literal `{{ chip.label }}` text.
    """
    from build_site import find_block  # same balanced-tag scanner as the build

    for tag in ('sc-if', 'sc-for'):
        while find_block(html, tag):
            os_, oe, cs, ce = find_block(html, tag)
            # Without the runtime's data there is nothing to iterate; keep one
            # copy of the body, which is the shape a restyle cares about.
            html = html[:os_] + html[oe:cs] + html[ce:]

    leftover = re.findall(r'\{\{([^}]*)\}\}', html)
    if leftover:
        print(f'  warning: {len(leftover)} unresolved placeholders dropped '
              f'({", ".join(sorted(set(x.strip() for x in leftover))[:4])})')
        html = re.sub(r'\{\{[^}]*\}\}', '', html)
    return html


def hovers_to_css(html):
    """Turn runtime style-hover / style-focus attributes into real CSS rules."""
    rules = {}

    def swap(m):
        tag = m.group(0)
        classes = []
        for kind in ('hover', 'focus'):
            am = re.search(rf'\sstyle-{kind}="([^"]*)"', tag)
            if am:
                decl = am.group(1).strip().rstrip(';')
                key = (kind, decl)
                rules.setdefault(key, f'i{kind[0]}{len(rules)}')
                classes.append(rules[key])
                tag = tag[: am.start()] + tag[am.end():]
        if not classes:
            return tag
        cm = re.search(r'\sclass="([^"]*)"', tag)
        if cm:
            return tag[: cm.start()] + f' class="{cm.group(1)} {" ".join(classes)}"' + tag[cm.end():]
        return tag[:-1] + f' class="{" ".join(classes)}"' + tag[-1]

    html = re.sub(r'<[a-zA-Z][^>]*>', swap, html)
    css = '\n'.join(f'.{name}:{kind}{{{decl}}}' for (kind, decl), name in rules.items())
    return html, css


# ── Views ─────────────────────────────────────────────────────────────────
VIEW_OPEN = re.compile(r'<section[^>]*\sdata-view="([^"]+)"[^>]*>')


def split_views(html):
    """Return {route: markup} for every data-view section, by balanced scan."""
    from build_site import find_block

    out = {}
    pos = 0
    while True:
        m = VIEW_OPEN.search(html, pos)
        if not m:
            break
        # Find this section's matching close by scanning from its own start.
        b = find_block(html[m.start():], 'section')
        if not b:
            break
        os_, oe, cs, ce = b
        out[m.group(1)] = html[m.start():m.start() + ce]
        pos = m.start() + ce
    return out


def parts_in(markup):
    return set(re.findall(r'data-part="([^"]+)"', markup))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('source', help='the file Claude Design returned')
    ap.add_argument('--dry-run', action='store_true',
                    help='report what would change without writing')
    args = ap.parse_args()

    src = Path(args.source)
    if not src.exists():
        die(f'{src} not found')
    if not SITE.exists():
        die(f'{SITE} not found — run build_site.py first')

    raw = src.read_text(encoding='utf-8')
    incoming, kind = unwrap(raw)
    print(f'  source format: {kind} ({len(raw):,} bytes in, {len(incoming):,} after unwrap)')

    incoming = compile_directives(incoming)
    incoming, extra_css = hovers_to_css(incoming)
    if extra_css:
        print(f'  {len(extra_css.splitlines())} hover/focus rules recovered from attributes')

    current = SITE.read_text(encoding='utf-8')
    cur_views = split_views(current)
    new_views = split_views(incoming)

    if not cur_views:
        die('no data-view sections in site/index.html — has it been overwritten?')

    returned = [v for v in new_views if v in cur_views]
    missing = [v for v in cur_views if v not in new_views]
    unknown = [v for v in new_views if v not in cur_views]

    print(f'\n  views in site   : {len(cur_views)}')
    print(f'  views returned  : {len(returned)}')
    if missing:
        print(f'  views untouched : {len(missing)}  (kept as they are)')
        for v in missing[:6]:
            print(f'      {v}')
        if len(missing) > 6:
            print(f'      … and {len(missing) - 6} more')
    if unknown:
        print(f'  unrecognised    : {len(unknown)}  (ignored — data-view renamed?)')
        for v in unknown:
            print(f'      {v}')

    # A returned view that lost its hooks cannot be merged safely: the next
    # round trip would have nothing to match on.
    dropped_hooks = []
    for v in returned:
        lost = parts_in(cur_views[v]) - parts_in(new_views[v])
        if lost:
            dropped_hooks.append((v, sorted(lost)))

    if dropped_hooks:
        print('\n  WARNING — data-part attributes missing from returned views:')
        for v, lost in dropped_hooks:
            print(f'      {v}: {", ".join(lost)}')
        print('  Those components merge, but the NEXT round trip cannot find them.')
        print('  Ask Design to keep the attributes, or re-run build_site.py to restore.')

    if not returned:
        if not new_views:
            die('no data-view attributes at all in this file.\n'
                '  It was not produced from site/index.html — most likely it predates\n'
                '  the hooks, or Design rebuilt the page from scratch rather than\n'
                '  restyling the file it was given.\n'
                '  Nothing was written. Hand Design site/index.html and try again.')
        die('data-view attributes are present but none matches this site.\n'
            f'  Found: {", ".join(sorted(new_views)[:6])}\n'
            '  The values were renamed. Nothing was written.')

    if args.dry_run:
        print('\n  dry run — nothing written')
        return

    merged = current
    for v in returned:
        merged = merged.replace(cur_views[v], new_views[v], 1)

    if extra_css:
        merged = merged.replace(
            '</style>',
            '\n/* Recovered from Design\'s runtime hover/focus attributes. */\n'
            + extra_css + '\n</style>', 1)

    INCOMING.mkdir(parents=True, exist_ok=True)
    keep = INCOMING / src.name
    if not keep.exists():
        keep.write_text(raw, encoding='utf-8')
        print(f'\n  archived the return at {keep.relative_to(REPO)}')

    SITE.write_text(merged, encoding='utf-8')
    print(f'  site/index.html updated: {len(current):,} → {len(merged):,} chars')
    print(f'  {len(returned)} view(s) restyled, {len(missing)} kept')
    print('\n  next: node scripts/design/verify.mjs')


if __name__ == '__main__':
    main()
