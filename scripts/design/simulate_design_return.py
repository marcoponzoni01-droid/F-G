"""Fake a Claude Design return: restyle one view, wrap in their bundle format."""
import json, gzip, base64, re, sys
from pathlib import Path

site = Path('/home/user/F-G/site/index.html').read_text()

# Restyle: brass -> cyan accent, and fatten the card border. Design works in
# inline styles, so this is what a real restyle looks like coming back.
restyled = site.replace('#c9a227', '#3fb6c8').replace('rgba(201,162,39,0.14)', 'rgba(63,182,200,0.16)')
restyled = restyled.replace('border:1px solid #242932;background:#12151a;padding:20px',
                            'border:2px solid #2c3440;background:#141922;padding:24px')
# Design also reintroduces runtime hover attributes on things it touches.
restyled = restyled.replace('<article class="h1 v2-article-card"', '<article class="h1 v2-article-card" style-hover="border-color:#3fb6c8"', 1)

# Their exporter keeps only the homepage in the template when the editor session
# was scoped to it — reproduce a PARTIAL return: home only.
m = re.search(r'(<section class="v2-view" data-view="/" [\s\S]*?)(?=\n<section class="v2-view")', restyled)
home = m.group(1)
partial = f'<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><x-dc>{home}</x-dc></body></html>'

bundle = (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bundled Page</title></head><body>'
    '<script type="__bundler/manifest">' + json.dumps({
        "fake-uuid": {"mime": "text/javascript", "compressed": True,
                      "data": base64.b64encode(gzip.compress(b"// runtime")).decode()}
    }) + '</script>'
    '<script type="__bundler/template">' + json.dumps(partial) + '</script>'
    '<script type="__bundler/page_order">[]</script>'
    '</body></html>'
)
Path('/tmp/design-return.html').write_text(bundle)
print(f'simulated return: {len(bundle):,} bytes, 1 view (home), accent #c9a227 -> #3fb6c8')
