#!/usr/bin/env python3
"""
Fake a return from Claude Design, so the round trip can be tested without one.

Reproduces the three things their export actually does, taken from the real
file in design/sources: it restyles inline (they inline literals rather than
using tokens), it reintroduces runtime `style-hover` attributes, and it comes
back as a bundle with the markup as a JSON string in `__bundler/template`.

Deliberately PARTIAL — one view of thirteen. That is what happened the first
time, and it is the case the merge has to survive.

Writes the fake return to the path given, or /tmp/design-return.html.
"""

from pathlib import Path
import base64
import gzip
import json
import re
import sys

REPO = Path(__file__).resolve().parent.parent.parent
SITE = REPO / 'site/index.html'
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/design-return.html')

site = SITE.read_text(encoding='utf-8')

# Design inlines literals rather than editing tokens, so a restyle arrives as
# changed hex throughout. Brass to cyan, and a heavier card.
restyled = (site
            .replace('#c9a227', '#3fb6c8')
            .replace('rgba(201,162,39,0.14)', 'rgba(63,182,200,0.16)')
            .replace('border:1px solid #242932;background:#12151a;padding:20px',
                     'border:2px solid #2c3440;background:#141922;padding:24px'))

# Their editor re-adds runtime hover attributes on anything it touches.
restyled = restyled.replace('<article class="h1 v2-article-card"',
                            '<article class="h1 v2-article-card" '
                            'style-hover="border-color:#3fb6c8"', 1)

m = re.search(r'(<section class="v2-view" data-view="/" [\s\S]*?)(?=\n<section class="v2-view")',
              restyled)
if not m:
    sys.exit('simulate: could not isolate the home view from site/index.html')

partial = ('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>'
           f'<x-dc>{m.group(1)}</x-dc></body></html>')

bundle = (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bundled Page</title>'
    '</head><body>'
    '<script type="__bundler/manifest">'
    + json.dumps({'fake-uuid': {'mime': 'text/javascript', 'compressed': True,
                                'data': base64.b64encode(
                                    gzip.compress(b'// runtime')).decode()}})
    + '</script>'
    '<script type="__bundler/template">' + json.dumps(partial) + '</script>'
    '<script type="__bundler/page_order">[]</script>'
    '</body></html>'
)

OUT.write_text(bundle, encoding='utf-8')
print(f'simulated return: {len(bundle):,} bytes, 1 view of 13, accent #c9a227 -> #3fb6c8')
