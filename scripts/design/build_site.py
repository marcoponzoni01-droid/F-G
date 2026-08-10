#!/usr/bin/env python3
"""
The Dossier — Version 2: Claude Design's homepage, plus Archive and Studies.

Design shipped a homepage sketch in a live-editor bundle: a `<x-dc>` template
with `sc-for` / `sc-if` / `{{ }}` directives, driven by a `DCLogic` class, on
top of ~210 KB of React and a proprietary runtime. None of that can go in an
artifact — the runtime is gone the moment it leaves their editor — so this
compiles the template to static HTML instead of reproducing it by hand. That
matters: retyping their markup would silently drift from their design, and the
whole point is to carry it over exactly.

Three things Design's sketch does not have, and this must supply:

  1. Archive and Studies pages. The sketch is a homepage; its #archive and
     #studies links are anchors to homepage sections. Both pages are authored
     here in Design's own vocabulary — their card, their chip tiers, their
     section headers, their type scale — populated from the real corpus.
  2. Hover states as CSS. `style-hover` / `style-focus` are runtime attributes;
     they become generated classes with real :hover / :focus rules.
  3. Any responsive behaviour at all. The sketch is desktop-only — fixed
     three-column grids and a 384px newsletter block — which overflows a phone.
     Design's desktop layout is left untouched; narrow viewports get the
     minimum needed to stop the body scrolling sideways.

Design committed to a single dark theme with explicit hex throughout. That is
kept: no light palette is reintroduced, and every colour stays painted, so the
page holds on any host ground.

Run:  python3 v2.py
"""

from pathlib import Path
import base64
import gzip
import json
import os
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
UPLOAD = REPO / 'design/sources/design-homepage-sketch-2026-08-10.html'
INDEX = REPO / 'dist/search-index.json'
OUT = REPO / 'site/index.html'

log = []


def die(msg):
    sys.exit(f'v2: {msg}')


# ── Design's palette, read off their sketch ───────────────────────────────
PAPER = '#0b0d10'
SURFACE = '#12151a'
LINE = '#242932'
LINE_STRONG = '#333a46'
INK = '#e9eaee'
INK_MUTED = '#9ba2ae'
INK_FAINT = '#7b838f'
ACCENT = '#c9a227'
ACCENT_SOFT = 'rgba(201,162,39,0.14)'

SERIF = "ui-serif,Georgia,Cambria,'Times New Roman',serif"
SANS = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace"

MONO_LABEL = (
    f'font-family:{MONO};font-size:11px;letter-spacing:0.12em;'
    f'text-transform:uppercase;color:{INK_FAINT}'
)


# ── 1. Unpack Design's bundle ─────────────────────────────────────────────
def design_template():
    src = UPLOAD.read_text(encoding='utf-8')
    m = re.search(r'<script type="__bundler/template">([\s\S]*?)</script>', src)
    if not m:
        die('no __bundler/template in the upload')
    tpl = json.loads(m.group(1))
    log.append(f"Design's template unpacked ({len(tpl):,} chars)")
    return tpl


# ── 2. The data Design's DCLogic produces ─────────────────────────────────
# Transcribed from their renderVals() with the default props
# (showMarketPanel: true, newsletterState: 'coming soon').
def chips(types=(), regions=(), assets=()):
    """Design's three-tier chip rule: type brass, region mid, asset faint."""
    out = []
    for l in types:
        out.append({'label': l, 'border': ACCENT, 'color': ACCENT, 'bg': ACCENT_SOFT,
                    'href': '/archive', 'tier': 'chip-type'})
    for l in regions:
        out.append({'label': l, 'border': LINE_STRONG, 'color': INK_MUTED,
                    'bg': 'transparent', 'href': '/archive', 'tier': 'chip-region'})
    for l in assets:
        out.append({'label': l, 'border': LINE, 'color': INK_FAINT, 'bg': 'transparent',
                    'href': '/archive', 'tier': 'chip-asset'})
    return out


MARKET = [
    ('S&P 500', '6,412.30', '+0.4%'),
    ('NASDAQ', '21,880.15', '+0.9%'),
    ('Brent Oil', '84.20', '+2.1%'),
    ('US Dollar Index', '103.85', '−0.3%'),
    ('FTSE MIB', '35,140.00', '−0.7%'),
]

HOME_VALS = {
    'showMarketPanel': True,
    'newsletterNote': (
        'Subscriptions open shortly — the full archive is free to read in the meantime.'
    ),
    'heroChips': chips(['Supply chain'], ['Middle East', 'Europe', 'Global'],
                       ['Freight', 'Brent', 'EUR']),
    'marketMoves': [
        {'instrument': i, 'level': l, 'change': c,
         'tone': '#46b07d' if c.startswith('+') else '#dc6058'}
        for i, l, c in MARKET
    ],
    'recent': [
        {
            'href': '/issues/2026-07-19-sanctions-designation-gap',
            'eyebrow': 'No. 7 · 19 Jul 2026',
            'title': 'The designation gap: why sanctions price in before they bite',
            'dek': 'The market moves on the announcement. The economy moves on the '
                   'enforcement. The distance between those two dates is where the '
                   'mispricing lives.',
            'chips': chips(['Sanctions'], ['Russia & CIS', 'United States', 'Europe'],
                           ['Sovereign Debt', 'FX']),
        },
        {
            'href': '/issues/2026-07-12-substitution-clock',
            'eyebrow': 'No. 6 · 12 Jul 2026',
            'title': 'The substitution clock: what export controls actually buy',
            'dek': 'A control does not deny a capability. It prices delay — and the '
                   'market almost always misprices how long the delay lasts.',
            'chips': chips(['Trade policy'], ['China', 'United States', 'Japan & Korea'],
                           ['Equities', 'Commodities']),
        },
        {
            'href': '/issues/2026-07-05-election-premium',
            'eyebrow': 'No. 5 · 05 Jul 2026',
            'title': 'The election premium is paid before the vote',
            'dek': 'Sovereign spreads widen through a campaign and compress on the '
                   'result — very often regardless of who wins.',
            'chips': chips(['Elections'], ['Latin America', 'Global'],
                           ['Sovereign Debt', 'FX', 'USD']),
        },
    ],
    'studies': [
        {
            'href': '/studies/italy-the-debt-the-banks-and-the-spread',
            'eyebrow': 'Study · Italy',
            'title': 'Italy: the debt, the banks and the spread',
            'dek': 'A debt stock that size is not a solvency question. It is a rollover '
                   'question, and the answer is written on the balance sheets of the '
                   'banks that hold it.',
            'revision': 'Updated 30 Jul 2026',
            'chips': chips(['Sovereign debt', 'Monetary policy', 'Elections'], ['Europe'],
                           ['Sovereign Debt', 'Credit', 'Rates']),
        },
        {
            'href': '/studies/what-a-central-bank-can-do-about-energy',
            'eyebrow': 'Study · Monetary policy and supply shocks',
            'title': 'What a central bank can and cannot do about an energy shock',
            'dek': 'Rates cannot produce gas. What they can do is decide whether one '
                   'expensive winter becomes a decade of expectations.',
            'revision': 'Published 30 Jun 2026',
            'chips': chips(['Monetary policy', 'Energy', 'Supply chain'],
                           ['Europe', 'United States', 'Global'],
                           ['Rates', 'Natural Gas', 'FX']),
        },
    ],
}


# ── 3. Compile the template ───────────────────────────────────────────────
def resolve(expr, scope):
    expr = expr.strip()
    if expr == 'true':
        return True
    if expr == 'false':
        return False
    cur = scope
    for part in expr.split('.'):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            die(f'unresolved template expression: {{{{ {expr} }}}}')
    return cur


def find_block(html, tag, start=0):
    """Locate the first balanced <tag …>…</tag>, returning (open, inner, close)."""
    om = re.compile(rf'<{tag}\b[^>]*>').search(html, start)
    if not om:
        return None
    depth = 1
    pos = om.end()
    token = re.compile(rf'<{tag}\b[^>]*>|</{tag}>')
    while depth:
        tm = token.search(html, pos)
        if not tm:
            die(f'unbalanced <{tag}>')
        depth += 1 if tm.group(0).startswith(f'<{tag}') else -1
        pos = tm.end()
    return om.start(), om.end(), tm.start(), tm.end()


def expand(html, scope):
    """Expand sc-for / sc-if / {{ }} against a scope, outermost-first."""
    # sc-if
    while True:
        b = find_block(html, 'sc-if')
        if not b:
            break
        os_, oe, cs, ce = b
        attrs = html[os_:oe]
        m = re.search(r'value="\{\{([^}]*)\}\}"', attrs)
        keep = bool(resolve(m.group(1), scope)) if m else True
        inner = expand(html[oe:cs], scope) if keep else ''
        html = html[:os_] + inner + html[ce:]

    # sc-for
    while True:
        b = find_block(html, 'sc-for')
        if not b:
            break
        os_, oe, cs, ce = b
        attrs = html[os_:oe]
        lm = re.search(r'list="\{\{([^}]*)\}\}"', attrs)
        am = re.search(r'as="([^"]+)"', attrs)
        if not lm or not am:
            die('sc-for missing list/as')
        items = resolve(lm.group(1), scope)
        var = am.group(1)
        body = html[oe:cs]
        out = ''.join(expand(body, {**scope, var: it}) for it in items)
        html = html[:os_] + out + html[ce:]

    # interpolation
    def sub(m):
        v = resolve(m.group(1), scope)
        return '' if v is None else str(v)

    return re.sub(r'\{\{([^}]*)\}\}', sub, html)


class Hovers:
    """
    Turn Design's runtime style-hover / style-focus attributes into real CSS.

    Their editor applies these live; an artifact has no runtime, so each unique
    declaration becomes a class with a matching :hover / :focus rule. Identical
    declarations share a class, which keeps the sheet small — the sketch reuses
    the same handful of hover treatments throughout.
    """

    def __init__(self):
        self.rules = {}

    def cls(self, kind, decl):
        key = (kind, decl.strip().rstrip(';'))
        if key not in self.rules:
            self.rules[key] = f'{kind[0]}{len(self.rules)}'
        return self.rules[key]

    def apply(self, html):
        def swap(m):
            tag = m.group(0)
            classes = []
            for kind in ('hover', 'focus'):
                am = re.search(rf'\sstyle-{kind}="([^"]*)"', tag)
                if am:
                    classes.append(self.cls(kind, am.group(1)))
                    tag = tag[: am.start()] + tag[am.end():]
            if not classes:
                return tag
            cm = re.search(r'\sclass="([^"]*)"', tag)
            if cm:
                merged = cm.group(1) + ' ' + ' '.join(classes)
                return tag[: cm.start()] + f' class="{merged}"' + tag[cm.end():]
            return tag[:-1] + f' class="{" ".join(classes)}"' + tag[-1]

        return re.sub(r'<[a-zA-Z][^>]*>', swap, html)

    def css(self):
        out = []
        for (kind, decl), name in self.rules.items():
            out.append(f'.{name}:{kind}{{{decl}}}')
        return '\n'.join(out)


# Every link in the sketch points at "#": it is a single-page mock, so nothing
# had anywhere to go. Each is given its real route before expansion, while each
# still appears exactly once in the template — after the sc-for loops run there
# would be nine card links to tell apart. Anything routing to a view this
# artifact does not carry resolves to an honest toast rather than a dead click.
LINK_ROUTES = [
    (r'<a href="#">(\s*<span style="display:block;font-family:ui-serif)', r'<a href="/">\1'),
    (r'<a href="#"(\s+style="flex:0 0 auto;border:1px solid \#c9a227)', r'<a href="/subscribe"\1'),
    (r'<a href="#"(\s+style="color:\#e9eaee">This week)', r'<a href="/"\1'),
    (r'<a href="#"(\s+style="color:\#7b838f"[^>]*>About Us)', r'<a href="/about"\1'),
    (r'<a href="#"(\s+style="color:\#7b838f"[^>]*>RSS)', r'<a href="/rss.xml"\1'),
    (r'<a href="#"(\s+style-hover="color:\#c9a227">\s*Red Sea)',
     r'<a href="/issues/2026-07-26-red-sea-reroutes"\1'),
    (r'<a href="#"(\s+style="display:inline-block;border:1px solid \{\{ chip\.border)',
     r'<a href="{{ chip.href }}"\1'),
    (r'<a href="#"(\s+style="display:inline-flex)',
     r'<a href="/issues/2026-07-26-red-sea-reroutes"\1'),
    (r'<a href="#"(\s+style-hover="color:\#e9eaee">All issues)', r'<a href="/archive"\1'),
    # Design reuses one card markup for the recent issues and the studies, so
    # this rule is expected to fire in both loops.
    (r'<a href="#"(\s+style-hover="color:\#c9a227">\{\{ entry\.title)',
     r'<a href="{{ entry.href }}"\1', 2),
    (r'<a href="#"(\s+style-hover="color:\#e9eaee">All studies)', r'<a href="/studies"\1'),
    (r'<a href="#"(\s+style-hover="color:\#e9eaee">About Us)', r'<a href="/about"\1'),
    (r'<a href="#"(\s+style-hover="color:\#e9eaee">Help)', r'<a href="/help"\1'),
]


def rewrite_links(tpl):
    for rule in LINK_ROUTES:
        pattern, repl = rule[0], rule[1]
        expected = rule[2] if len(rule) > 2 else 1
        tpl, n = re.subn(pattern, repl, tpl)
        if n != expected:
            die(f'link rewrite matched {n} times (expected {expected}): {pattern[:60]}')
    tpl = tpl.replace('href="#archive"', 'href="/archive"')
    tpl = tpl.replace('href="#studies"', 'href="/studies"')
    if 'href="#"' in tpl:
        die('a placeholder href="#" survived the rewrite')
    log.append(f'{len(LINK_ROUTES) + 2} placeholder links given real routes')
    return tpl


def compile_home(tpl, hovers):
    """Extract Design's <x-dc> body and helmet styles, expanded and de-runtimed."""
    hm = re.search(r'<helmet>([\s\S]*?)</helmet>', tpl)
    helmet = hm.group(1) if hm else ''
    sm = re.search(r'<style>([\s\S]*?)</style>', helmet)
    helmet_css = sm.group(1).strip() if sm else ''

    xm = re.search(r'<x-dc>([\s\S]*?)</x-dc>', tpl)
    if not xm:
        die('no <x-dc> in the template')
    body = xm.group(1)
    body = re.sub(r'<helmet>[\s\S]*?</helmet>', '', body)

    body = expand(body, HOME_VALS)
    if '{{' in body or '<sc-' in body:
        die('template still has unexpanded directives')

    # The editor's comment anchors mean nothing outside it.
    body = re.sub(r'\sdata-comment-anchor="[^"]*"', '', body)
    body = hovers.apply(body)

    log.append(f"homepage compiled from Design's template ({len(body):,} chars)")
    return body, helmet_css


def split_chrome(body):
    """
    Separate Design's shared chrome from the homepage's own content.

    Their sketch is one document: masthead, <main>, footer inside a flex column.
    The masthead and footer are the same on every view, so they are lifted out
    and the three views swap inside <main> — which is also what the real site
    does with its layout component.
    """
    hs = body.index('<header')
    he = body.index('</header>') + len('</header>')
    ms = body.index('<main')
    me = body.index('</main>') + len('</main>')
    fs = body.index('<footer')
    fe = body.index('</footer>') + len('</footer>')

    header = body[hs:he]
    footer = body[fs:fe]
    main = body[ms:me]

    # Inside <main> Design wraps everything in the 1024px container; the views
    # each get their own copy of that wrapper.
    cs = main.index('<div style="max-width:1024px')
    ce = main.rindex('</div>')
    home_inner = main[main.index('>', cs) + 1:ce].strip()

    open_tag = body[: hs].strip()  # the outer flex-column <div …>
    return open_tag, header, home_inner, footer


# ── 4. Archive and Studies, in Design's vocabulary ────────────────────────
EVENT_LABEL = {
    'conflict': 'Conflict', 'sanctions': 'Sanctions', 'elections': 'Elections',
    'trade-policy': 'Trade policy', 'energy': 'Energy', 'monetary': 'Monetary policy',
    'sovereign-debt': 'Sovereign debt', 'supply-chain': 'Supply chain',
}
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

STUDY_META = {
    'italy-the-debt-the-banks-and-the-spread': {
        'subject': 'Italy', 'kind': 'country', 'revision': 'Updated 30 Jul 2026',
    },
    'what-a-central-bank-can-do-about-energy': {
        'subject': 'Monetary policy and supply shocks', 'kind': 'mechanism',
        'revision': 'Published 30 Jun 2026',
    },
}


def fmt_date(iso):
    y, m, d = iso.split('-')
    return f'{d} {MONTHS[int(m) - 1]} {y}'


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
             .replace('"', '&quot;'))


def chip_html(c, as_link=False):
    style = (f'display:inline-block;border:1px solid {c["border"]};color:{c["color"]};'
             f'background:{c["bg"]};padding:2px 8px;font-size:12px;line-height:20px;'
             f'white-space:nowrap')
    return (f'<li><span data-part="{c.get("tier", "chip")}" style="{style}">'
            f'{esc(c["label"])}</span></li>')


def record_chips(r):
    return chips(
        [EVENT_LABEL.get(t, t) for t in r.get('eventTypes', [])],
        r.get('regions', []),
        r.get('assets', []),
    )


def card(r, hovers, current=False):
    """Design's card, reused verbatim for both kinds."""
    is_study = r['kind'] == 'study'
    meta = STUDY_META.get(r['id'], {})
    # Design's two eyebrows differ deliberately: the issue eyebrow is a short
    # date and carries white-space:nowrap, the study eyebrow is a subject that
    # can run long and is allowed to wrap. Giving both nowrap clips subjects
    # like "Monetary policy and supply shocks" at the card edge.
    if is_study:
        eyebrow = f'Study · {meta.get("subject", "")}'
        eyebrow_style = (f'font-family:{MONO};font-size:11px;letter-spacing:0.12em;'
                         f'text-transform:uppercase;color:{ACCENT}')
        wrap = ''
    else:
        eyebrow = f'No. {r["issueNumber"]} · {fmt_date(r["date"])}'
        eyebrow_style = MONO_LABEL
        wrap = ';white-space:nowrap'

    badge = ''
    if current:
        badge = (
            f'<span style="font-family:{MONO};font-size:11px;letter-spacing:0.12em;'
            f'text-transform:uppercase;color:{ACCENT};border:1px solid {ACCENT};'
            f'background:{ACCENT_SOFT};padding:1px 7px;white-space:nowrap">'
            f'Current issue</span>'
        )

    rev = ''
    if is_study:
        rev = (f'<p style="margin:8px 0 0;{MONO_LABEL}">'
               f'{esc(meta.get("revision", ""))}</p>')

    ch = ''.join(chip_html(c) for c in record_chips(r))
    hcls = hovers.cls('hover', f'border-color:{LINE_STRONG}')
    tcls = hovers.cls('hover', f'color:{ACCENT}')

    part = 'card-study' if is_study else 'card-issue'
    return f'''<article class="{hcls}" data-part="{part}" data-rec="{r['id']}" style="min-width:0;border:1px solid {LINE};background:{SURFACE};padding:20px">
  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px">
    <span style="{eyebrow_style}{wrap}">{esc(eyebrow)}</span>{badge}
  </div>
  <h3 style="margin:10px 0 0;font-family:{SERIF};font-size:20px;font-weight:600;line-height:1.375;letter-spacing:-0.015em;text-wrap:pretty"><a class="{tcls}" href="{r['href']}">{esc(r['title'])}</a></h3>
  <p style="margin:8px 0 0;font-size:14px;line-height:1.625;color:{INK_MUTED};text-wrap:pretty">{esc(r['dek'])}</p>
  {rev}
  <ul style="display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 0;padding:0;list-style:none">{ch}</ul>
</article>'''


def page_head(title, dek):
    return f'''<section style="padding:48px 0 32px">
  <p style="margin:0;{MONO_LABEL}">{esc(title.upper())}</p>
  <h1 style="margin:16px 0 0;font-family:{SERIF};font-size:48px;font-weight:600;line-height:1.1;letter-spacing:-0.015em;max-width:768px;text-wrap:balance">{esc(dek[0])}</h1>
  <p style="margin:20px 0 0;max-width:672px;font-size:18px;line-height:1.625;color:{INK_MUTED};text-wrap:pretty">{esc(dek[1])}</p>
</section>'''


def field(label, inner):
    return f'''<div style="display:flex;flex-direction:column;gap:6px;min-width:0">
  <label style="{MONO_LABEL}">{esc(label)}</label>{inner}
</div>'''


INPUT_STYLE = (f'width:100%;box-sizing:border-box;background:{PAPER};'
               f'border:1px solid {LINE_STRONG};color:{INK};font-family:inherit;'
               f'font-size:14px;padding:8px 12px;outline:none')


def build_archive(records, hovers):
    fcls = hovers.cls('focus', f'border-color:{ACCENT}')
    hcls = hovers.cls('hover', f'border-color:{INK_MUTED}')

    def sel(fid, label, options, all_label):
        opts = ''.join(f'<option value="{esc(v)}">{esc(l)}</option>' for v, l in options)
        return field(label, f'<select id="{fid}" data-filter="{fid}" class="{fcls}" '
                            f'style="{INPUT_STYLE}"><option value="">{esc(all_label)}'
                            f'</option>{opts}</select>')

    regions = sorted({x for r in records for x in r.get('regions', [])})
    assets = sorted({x for r in records for x in r.get('assets', [])})
    types = sorted({x for r in records for x in r.get('eventTypes', [])})

    controls = ''.join([
        field('Search', f'<input id="v2-q" data-filter="q" class="{fcls}" type="search" '
                        f'placeholder="Sanctions, freight, sovereign debt…" '
                        f'style="{INPUT_STYLE}">'),
        sel('kind', 'Kind', [('issue', 'Weekly issues'), ('study', 'Studies')], 'Everything'),
        sel('type', 'Event type', [(t, EVENT_LABEL.get(t, t)) for t in types], 'All types'),
        sel('region', 'Region', [(x, x) for x in regions], 'All regions'),
        sel('asset', 'Asset class', [(x, x) for x in assets], 'All assets'),
        field('From', f'<input id="v2-from" data-filter="from" class="{fcls}" type="date" '
                      f'style="{INPUT_STYLE}">'),
        field('To', f'<input id="v2-to" data-filter="to" class="{fcls}" type="date" '
                    f'style="{INPUT_STYLE}">'),
    ])

    cards = '\n'.join(card(r, hovers, current=(i == 0 and r['kind'] == 'issue'))
                      for i, r in enumerate(records))

    return f'''{page_head('Archive', ('The record',
      'Every weekly issue and every study, kept permanently and searchable by full '
      'text as well as by region, asset class, event type and date. Free, and no '
      'account required.'))}

<section data-archive style="padding-bottom:48px">
  <form data-part="facets" data-archive-form onsubmit="return false" style="border:1px solid {LINE};background:{SURFACE};padding:20px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px" class="v2-facets">
    {controls}
    <div style="display:flex;align-items:flex-end">
      <button type="button" data-archive-clear class="{hcls}" style="border:1px solid {LINE_STRONG};background:transparent;color:{INK_MUTED};font-family:inherit;font-size:14px;padding:8px 16px;cursor:pointer">Clear filters</button>
    </div>
  </form>

  <p data-archive-count role="status" aria-live="polite" style="margin:20px 0 0;{MONO_LABEL}">{len(records)} entries</p>

  <div class="v2-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:20px">
{cards}
  </div>

  <p data-archive-empty hidden style="margin:24px 0 0;font-size:16px;color:{INK_MUTED}">Nothing matches those filters. <button type="button" data-archive-clear style="background:none;border:0;color:{ACCENT};font:inherit;cursor:pointer;text-decoration:underline">Clear them</button> to see everything.</p>
</section>'''


def build_studies(records, hovers):
    studies = [r for r in records if r['kind'] == 'study']
    groups = [
        ('Countries', 'How one economy transmits a shock.', 'country'),
        ('Mechanisms', 'How one channel works, wherever it runs.', 'mechanism'),
    ]
    tcls = hovers.cls('hover', f'color:{INK}')

    blocks = []
    for name, blurb, kind in groups:
        items = [r for r in studies if STUDY_META.get(r['id'], {}).get('kind') == kind]
        if not items:
            continue
        n = len(items)
        cards = '\n'.join(card(r, hovers) for r in items)
        blocks.append(f'''<section style="padding-bottom:32px">
  <div style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-top:1px solid {LINE};padding-top:32px;{MONO_LABEL}">
    <h2 style="margin:0;font-family:{MONO};font-size:16px;font-weight:700;letter-spacing:0.14em;color:{INK}">{esc(name)}</h2>
    <span>{n} {'study' if n == 1 else 'studies'}</span>
  </div>
  <p style="margin:12px 0 0;max-width:672px;font-size:14px;line-height:1.6;color:{INK_MUTED}">{esc(blurb)}</p>
  <div class="v2-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:20px">
{cards}
  </div>
</section>''')

    return f'''{page_head('Studies', ('The standing files',
      "The weekly issue reports what happened. A study explains the structure "
      "underneath it — how one country's economy transmits a shock, or how one "
      "mechanism works wherever it runs. Unlike an issue, a study is kept current: "
      "it carries the date it was last revised."))}

{''.join(blocks)}

<section style="padding-bottom:48px">
  <p style="margin:0"><a class="{tcls}" href="/archive" style="color:{ACCENT};font-size:16px">Search everything, issues and studies together →</a></p>
</section>'''


# ── 5. Responsive layer ───────────────────────────────────────────────────
# Design's sketch is desktop-only: no media query anywhere, fixed three-column
# grids, a 384px newsletter block and a 48px hero. On a 375px viewport that
# scrolls sideways. These rules change nothing above 900px — Design's layout is
# exactly as drawn — and below it they only reflow what would otherwise
# overflow. Inline styles are what the sketch uses, so overriding them needs
# !important; that is a consequence of their authoring format, not a preference.
RESPONSIVE = f'''
@media (max-width: 900px) {{
  .v2-grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }}
  .v2-facets {{ grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }}
}}

@media (max-width: 640px) {{
  .v2-grid {{ grid-template-columns: minmax(0, 1fr) !important; }}
  .v2-facets {{ grid-template-columns: minmax(0, 1fr) !important; }}
  .v2-shell {{ padding-left: 20px !important; padding-right: 20px !important; }}
  /* The wordmark, hero and section heads are all set in fixed px. */
  .v2-wordmark {{ font-size: 30px !important; }}
  .v2-hero-title {{ font-size: 32px !important; }}
  h1 {{ font-size: 32px !important; }}
  /* The newsletter block is a fixed 384px beside a flexible column. */
  .v2-news {{ width: 100% !important; flex: 1 1 auto !important; }}
  .v2-market {{ max-width: 100% !important; }}
}}

/* Design gave the nav no scroll affordance; five items at 13px with 0.14em
   tracking do not fit 375px, and wrapping them keeps their centred alignment. */
@media (max-width: 480px) {{
  .v2-nav {{ gap: 8px 20px !important; }}
}}

/* Keyboard focus: the sketch styles hover but never focus, and an artifact
   still has to be operable from the keyboard. */
:focus-visible {{ outline: 2px solid {ACCENT}; outline-offset: 2px; }}

[hidden] {{ display: none !important; }}
.v2-view[hidden] {{ display: none !important; }}
'''

TOAST_CSS = f'''
.v2-toast {{
  position: fixed; left: 50%; bottom: 20px; z-index: 70;
  transform: translate(-50%, 12px);
  padding: 9px 16px;
  font-family: {MONO}; font-size: 11px; letter-spacing: 0.06em;
  color: {INK}; background: {SURFACE}; border: 1px solid {LINE_STRONG};
  opacity: 0; pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}}
.v2-toast.show {{ opacity: 1; transform: translate(-50%, 0); }}
@media (prefers-reduced-motion: reduce) {{ .v2-toast {{ transition: none; }} }}
'''


ROUTER_JS = '''
/* ── Router ───────────────────────────────────────────────────────────────
   Design's markup and hrefs are untouched; clicks are intercepted so the real
   routes drive which view shows. Anything outside the three views this
   artifact carries says so rather than dying silently. */
(function () {
  const views = Array.from(document.querySelectorAll('[data-view]'));
  const toast = document.querySelector('.v2-toast');
  let timer;

  function flash(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function setNav(route) {
    document.querySelectorAll('[data-nav] a[href]').forEach((a) => {
      const on = a.getAttribute('href') === route;
      a.style.color = on ? '#e9eaee' : '#7b838f';
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function show(route, query) {
    const target = views.find((v) => v.dataset.view === route);
    if (!target) return false;
    // Views are visible in the markup so the file reads without scripts; the
    // hiding happens here, on the first show() call.
    views.forEach((v) => { v.hidden = v !== target; });
    setNav(route);
    window.scrollTo(0, 0);
    // The classification chips on an article link to /archive?type=…; without
    // this they would land on an unfiltered archive, which reads as the filter
    // silently failing rather than as a link to everything.
    if (route === '/archive' && window.__v2ApplyQuery) window.__v2ApplyQuery(query);
    return true;
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('/')) return;
    e.preventDefault();
    if (href === '/rss.xml') {
      flash('RSS feed — generated at build time, not part of this prototype.');
      return;
    }
    const [path, query] = href.split('?');
    if (!show(path, query)) {
      flash('Not in this prototype — the front page, Archive and Studies are.');
    }
  });

  show('/');
})();
'''

SEARCH_JS = '''
/* ── Archive: search and facets ───────────────────────────────────────────
   Weighted token matching over the same fields the real ArchiveExplorer
   searches. The index is embedded rather than fetched: an artifact runs under
   a CSP with no external hosts, so a fetch would fail and the archive would
   quietly show everything. */
(function () {
  const root = document.querySelector('[data-archive]');
  if (!root) return;

  let records;
  try {
    records = JSON.parse(document.getElementById('v2-index').textContent);
  } catch (err) {
    console.error('[archive] index failed to parse', err);
    return;
  }

  const controls = new Map();
  root.querySelectorAll('[data-filter]').forEach((el) => controls.set(el.dataset.filter, el));
  const cards = new Map();
  root.querySelectorAll('[data-rec]').forEach((el) => cards.set(el.dataset.rec, el));
  const countEl = root.querySelector('[data-archive-count]');
  const emptyEl = root.querySelector('[data-archive-empty]');
  const total = cards.size;

  const WEIGHTS = [['title', 3], ['dek', 2], ['summary', 2], ['tags', 2],
                   ['regions', 1.5], ['assets', 1.5], ['body', 1]];

  const norm = (s) => String(s || '').toLowerCase();

  function score(rec, terms) {
    let s = 0;
    for (const [field, w] of WEIGHTS) {
      const hay = norm(Array.isArray(rec[field]) ? rec[field].join(' ') : rec[field]);
      for (const t of terms) if (hay.includes(t)) s += w;
    }
    return s;
  }

  function val(name) {
    const el = controls.get(name);
    return el ? el.value.trim() : '';
  }

  function apply() {
    const q = val('q');
    const kind = val('kind');
    const type = val('type');
    const region = val('region');
    const asset = val('asset');
    const from = val('from');
    const to = val('to');
    const terms = q ? norm(q).split(/\\s+/).filter(Boolean) : [];
    const anyFilter = !!(q || kind || type || region || asset || from || to);

    let visible = 0;
    for (const rec of records) {
      const ok =
        (!terms.length || score(rec, terms) > 0) &&
        (!kind || rec.kind === kind) &&
        (!type || (rec.eventTypes || []).includes(type)) &&
        (!region || (rec.regions || []).includes(region)) &&
        (!asset || (rec.assets || []).includes(asset)) &&
        (!from || rec.date >= from) &&
        (!to || rec.date <= to);
      const card = cards.get(rec.id);
      if (card) card.style.display = ok ? '' : 'none';
      if (ok) visible += 1;
    }

    if (countEl) {
      // The archive holds issues and studies, so the noun is "entries".
      const noun = total === 1 ? 'entry' : 'entries';
      countEl.textContent = anyFilter ? visible + ' of ' + total + ' ' + noun
                                      : total + ' ' + noun;
    }
    if (emptyEl) emptyEl.hidden = visible > 0;
  }

  // Chips on the article pages deep-link into a filtered archive.
  window.__v2ApplyQuery = function (query) {
    controls.forEach((el) => { el.value = ''; });
    if (query) {
      new URLSearchParams(query).forEach((value, key) => {
        const el = controls.get(key);
        if (!el) return;
        // A stale or hand-edited link must not set a value the control has no
        // option for: the filter would match nothing and the archive would
        // look empty for no visible reason.
        if (el.tagName === 'SELECT' &&
            !Array.from(el.options).some((o) => o.value === value)) return;
        el.value = value;
      });
    }
    apply();
  };

  controls.forEach((el) => {
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  });
  root.querySelectorAll('[data-archive-clear]').forEach((b) =>
    b.addEventListener('click', () => {
      controls.forEach((el) => { el.value = ''; });
      apply();
    })
  );

  apply();
})();
'''


# ── 6. Article pages, lifted from the previous prototype ──────────────────
PROTO = REPO / 'design/sources/prototype-15-views.html'
VIEW_RE = re.compile(r'\n<section class="dossier-view" data-view="([^"]+)"')

# The article stylesheet is confined to this class. Without it Tailwind's
# preflight reaches Design's inline-styled pages and retypesets them.
ARTICLE_SCOPE = '.v2-article'


def scope_css(css, scope):
    """Rewrite every selector to sit under `scope`, via postcss."""
    src = HERE / '.scope-in.css'
    dst = HERE / '.scope-out.css'
    src.write_text(css, encoding='utf-8')
    r = subprocess.run(
        ['node', str(HERE / 'scope-css.mjs'), str(src), str(dst), scope],
        capture_output=True, text=True, cwd=str(HERE),
    )
    if r.returncode != 0:
        die(f'scope-css failed: {r.stderr.strip()}')
    log.append(r.stderr.strip().replace('scope-css: ', 'article CSS: '))
    out = dst.read_text(encoding='utf-8')
    src.unlink()
    dst.unlink()
    return out


def proto_parts():
    """
    Take the article pages, and the stylesheets they need, from the prototype.

    The issue and study pages already exist there, built from the real content
    and already verified. They are Tailwind markup resolving through the site's
    custom properties, so they need the compiled sheet, the post-build utility
    backfill and the chart stylesheet to render at all — the markup alone would
    come out unstyled.
    """
    if not PROTO.exists():
        die('the-dossier-prototype.html not found; the article pages come from it')
    h = PROTO.read_text(encoding='utf-8')

    # Views: everything under /issues/ or /studies/<slug>.
    starts = [(m.start(), m.group(1)) for m in VIEW_RE.finditer(h)]
    main_end = h.index('</main>')
    blocks, routes = [], []
    for i, (pos, route) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else main_end
        if route.startswith('/issues/') or (route.startswith('/studies/') and route != '/studies'):
            seg = h[pos:end]
            # The shell class differs between the two artifacts; the route
            # attribute is what the router keys on and is left alone.
            seg = seg.replace('<section class="dossier-view" data-view=',
                              f'<section class="v2-view {ARTICLE_SCOPE[1:]}" data-view=', 1)
            # Same reason as view(): the file must read without JavaScript.
            seg = seg.replace('" hidden>', '">', 1)
            blocks.append(seg)
            routes.append(route)

    if len(routes) != 10:
        die(f'expected 10 article pages, found {len(routes)}')

    # Stylesheets, by position: 1 = compiled Tailwind, 2 = utility backfill,
    # 4 = chart.css. 3 is the token block, replaced below with a dark-only one;
    # 5 is the handoff's notes overlay and has no place here.
    styles = [m for m in re.finditer(r'<style[^>]*>([\s\S]*?)</style>', h)]
    if len(styles) < 5:
        die(f'expected 5 style blocks in the prototype, found {len(styles)}')
    css = '\n'.join(styles[i].group(1) for i in (0, 1, 3))
    css = scope_css(css, ARTICLE_SCOPE)

    # The chart hover layer; the SVGs are complete without it, but the
    # crosshair and tooltip come from here.
    chart_js = ''
    for m in re.finditer(r'<script>([\s\S]*?)</script>', h):
        if 'Issue charts' in m.group(1):
            chart_js = m.group(1)
            break
    if not chart_js:
        die('chart hover script not found in the prototype')

    log.append(f'{len(routes)} article pages lifted from the prototype')
    return ''.join(blocks), css, chart_js


# Design's sketch is dark, with no light palette anywhere. The prototype's
# stylesheet carries both, switching on prefers-color-scheme — so on a
# light-preference machine the article pages would come up cream inside
# Design's near-black shell. These pin the tokens to the dark values and are
# emitted after the compiled sheet, so they win on source order over both its
# :root block and its light media query.
DARK_TOKENS = f'''
:root, {ARTICLE_SCOPE} {{
  color-scheme: dark;

  --paper:          {PAPER};
  --surface:        {SURFACE};
  --surface-raised: #171b21;
  --line:           {LINE};
  --line-strong:    {LINE_STRONG};
  --ink:            {INK};
  --ink-muted:      {INK_MUTED};
  --ink-faint:      {INK_FAINT};
  --accent:         {ACCENT};
  --accent-soft:    {ACCENT_SOFT};
  --pos:            #46b07d;
  --neg:            #dc6058;

  --font-serif: {SERIF};
  --font-sans:  {SANS};
  --font-mono:  {MONO};
}}
'''


# ── 7. Assemble ───────────────────────────────────────────────────────────
def add_class(html, anchor, cls, expected=1):
    """
    Add a class to the tag an anchor matches, without touching its style.

    Design authored everything as inline styles, so the responsive layer needs
    a hook on a handful of elements. Rewriting the opening tag to insert one is
    how the wordmark quietly lost `font-size:40px` and half its font stack: the
    replacement re-emitted only the part of the style the pattern had matched.
    Inserting straight after the tag name cannot truncate anything.
    """
    def ins(m):
        tag = m.group(0)
        name_end = re.match(r'<[a-zA-Z0-9-]+', tag).end()
        return tag[:name_end] + f' class="{cls}"' + tag[name_end:]

    html, n = re.subn(anchor, ins, html)
    if n != expected:
        die(f'responsive hook {cls} matched {n} times (expected {expected})')
    return html


# ── Stable hooks for the round trip ──────────────────────────────────────
# Every component carries data-part. It is the one thing Design must not
# remove, and the file says so in the banner. The importer maps styles back by
# these, not by document position, so Design can move, rewrite or reorder
# anything and the merge still lands. Evidence the attribute survives: Design's
# own returned template kept its editor's data-comment-anchor attributes.
DATA_PARTS = [
    (r'<header style="border-bottom:1px solid \#242932">', 'masthead'),
    (r'<section style="padding:48px 0 56px;border-bottom', 'hero'),
    (r'<section class="v2-market"', 'market-panel'),
    (r'<div style="border:1px solid \#242932;background:\#12151a;padding:24px;'
     r'display:flex;flex-wrap:wrap', 'newsletter'),
    (r'<footer style="margin-top:80px', 'footer'),
]


def add_attr(html, anchor, attr, expected=1):
    """Insert an attribute after the tag name, leaving the style untouched."""
    def ins(m):
        tag = m.group(0)
        name_end = re.match(r'<[a-zA-Z0-9-]+', tag).end()
        return tag[:name_end] + f' {attr}' + tag[name_end:]

    html, n = re.subn(anchor, ins, html)
    if n != expected:
        die(f'data-part hook {attr} matched {n} times (expected {expected})')
    return html


def tag_parts(html):
    """Mark Design's components so the importer can find them again."""
    for anchor, part in DATA_PARTS:
        html = add_attr(html, anchor, f'data-part="{part}"')
    log.append(f'{len(DATA_PARTS)} data-part hooks placed on Design\'s components')
    return html


def tag_classes(html):
    """Hook the few inline-styled elements the responsive layer has to reach."""
    html = add_class(html, r'<span style="display:block;font-family:ui-serif[^"]*font-size:40px',
                     'v2-wordmark')
    html = add_class(html, r'<ul style="display:flex;flex-wrap:wrap;align-items:center;'
                           r'justify-content:center', 'v2-nav')
    html = add_class(html, r'<div style="width:384px;flex:0 0 auto"', 'v2-news')
    html = add_class(html, r'<section style="width:100%;max-width:560px', 'v2-market')
    html = add_class(html, r'<h1 style="margin:16px 0 0;font-family:ui-serif', 'v2-hero-title')
    # Design's two homepage card grids get the shared grid hook.
    html = html.replace(
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;'
        'margin-top:20px">',
        '<div class="v2-grid" style="display:grid;grid-template-columns:'
        'repeat(3,minmax(0,1fr));gap:16px;margin-top:20px">',
    )
    return html


def view(route, label, inner):
    # No `hidden` here on purpose — see NO_JS_NOTE. The router hides everything
    # but the current view on load, so with scripts on this behaves as a normal
    # site, and with scripts off the whole site is readable top to bottom.
    return (f'\n<section class="v2-view" data-view="{route}" data-view-label="{label}">'
            f'\n<div class="v2-shell" style="max-width:1024px;margin:0 auto;padding:0 32px">\n'
            f'{inner}\n</div>\n</section>\n')


def main():
    if not UPLOAD.exists():
        die('the uploaded sketch is not where it was expected')
    if not INDEX.exists():
        die('dist/search-index.json not found — run `npm run build` first')

    records = json.loads(INDEX.read_text(encoding='utf-8'))
    hovers = Hovers()

    tpl = design_template()
    tpl = rewrite_links(tpl)
    body, helmet_css = compile_home(tpl, hovers)
    body = tag_classes(body)
    body = tag_parts(body)
    open_tag, header, home_inner, footer = split_chrome(body)

    # The nav is the router's; mark it so active state can be driven.
    header = header.replace('<nav ', '<nav data-nav ', 1)

    # A/B switch for the regression check in regress-design.mjs: building
    # without the article layer gives the "before" side to diff Design's pages
    # against, so the claim that they are untouched can be demonstrated rather
    # than asserted.
    if os.environ.get('V2_NO_ARTICLES') == '1':
        articles, proto_css, chart_js = '', '', ''
        log.append('article layer omitted (V2_NO_ARTICLES=1)')
    else:
        articles, proto_css, chart_js = proto_parts()

    # The article pages bring their own container (mx-auto max-w-5xl px-5), so
    # they are not wrapped in Design's shell — doing so would double the
    # horizontal padding.
    views = (
        view('/', 'This week', home_inner)
        + view('/archive', 'Archive', build_archive(records, hovers))
        + view('/studies', 'Studies', build_studies(records, hovers))
        + articles
    )

    page = f'''<title>The Dossier</title>

<!-- ═══════════════════════════════════════════════════════════════════════
     THE DOSSIER — the whole site, one file. This file is the only copy.

     READ THIS BEFORE RESTYLING
     ──────────────────────────
     Change anything about how this looks: colour, type, spacing, layout, the
     lot. Three things must survive, because the toolchain that puts the work
     back into the site finds things by them:

       1. KEEP every data-part attribute. They mark the components: masthead,
          hero, market-panel, card-issue, card-study, chip-type, chip-region,
          chip-asset, facets, newsletter, footer. Move them, restyle them,
          reorder them — but do not drop the attribute.
       2. KEEP every data-view attribute and its value. Those are the 13
          pages. Renaming one loses that page.
       3. KEEP the href values. The navigation runs on them.

     Everything else is open.

     WHY EVERY PAGE IS VISIBLE AT ONCE
     ─────────────────────────────────
     All 13 views are stacked in this document with no `hidden` attribute, so
     the file reads top to bottom with no JavaScript. A small script hides all
     but the current view once it runs, which turns the same file into a
     working site. Do not add `hidden` back: a tool that does not run scripts
     would then see an empty page and rebuild from guesswork.

     Rebuild:  python3 scripts/design/build_site.py
     Bring a restyled copy back:
               python3 scripts/design/import_from_design.py <file>
     ═══════════════════════════════════════════════════════════════════════ -->

<!-- ═══════════════════════════════════════════════════════════════════════
     ARTICLE STYLESHEETS — compiled Tailwind, the post-build utility backfill
     and the chart sheet, carried over with the article pages from the earlier
     prototype. They style the issue and study pages only; Design's own pages
     are inline-styled and resolve nothing through these.
     ═══════════════════════════════════════════════════════════════════════ -->
<style>{proto_css}</style>

<style>
/* The article pages resolve their colours through these custom properties,
   and the sheet above ships both palettes with a prefers-color-scheme switch.
   Design's work is dark only, so the tokens are pinned to the dark values —
   otherwise an article would open cream inside a near-black shell for any
   reader whose system prefers light. Emitted after that sheet so it wins on
   source order over its :root block and its light media query alike. */
{DARK_TOKENS}
</style>

<!-- ═══════════════════════════════════════════════════════════════════════
     THE DOSSIER — VERSION 2

     The front page is Claude Design's sketch, compiled from their own
     template rather than retyped, so the markup and every value in it are
     theirs. Archive and Studies did not exist in that sketch; they are built
     here from the same vocabulary — their card, their three-tier chips, their
     type scale — and filled from the real corpus.

     Generated by scratchpad/v2.py. Do not hand-edit; rerun the script.
     ═══════════════════════════════════════════════════════════════════════ -->

<style>
/* Design's own global styles, from the helmet block of their sketch. */
{helmet_css}
</style>

<style>
/* Hover and focus states. Design authored these as runtime `style-hover` /
   `style-focus` attributes, which only their editor understands; each unique
   declaration became a class here. */
{hovers.css()}
</style>

<style>{RESPONSIVE}{TOAST_CSS}</style>

{open_tag}
{header}
<main id="main" style="flex:1;width:100%">
{views}
</main>
{footer}
</div>

<div class="v2-toast" role="status" aria-live="polite"></div>

<script type="application/json" id="v2-index">{json.dumps(records, separators=(',', ':'))}</script>

<script>{ROUTER_JS}</script>
<script>{SEARCH_JS}</script>

<!-- Chart crosshair and tooltip, from the prototype. Enhancement only: every
     chart's SVG is complete without it and every value is in its table. -->
<script>{chart_js}</script>
'''

    OUT.write_text(page, encoding='utf-8')
    for line in log:
        print(f'  {line}')
    print(f'  {len(hovers.rules)} hover/focus rules generated')
    print(f'  {len(records)} records embedded')
    print(f'  → {OUT.name}  ({len(page):,} chars)')


if __name__ == '__main__':
    main()
