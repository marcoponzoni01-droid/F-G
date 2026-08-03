# The Dossier

**The financial anatomy of geopolitical events.**

A publication with two services that are really one thing:

1. **Newsletter** — one issue a week on how the week's geopolitical events moved capital.
2. **Database** — a permanent, searchable archive of every issue, filterable by region, asset class, event type and date.

The central idea: **a newsletter issue and an archive entry are the same object at different ages.** There is no "move to archive" step, no published/archived flag, nothing to remember. Each issue is one file, and the newest date is the current issue. Commit next week's file and last week's demotes itself.

The five issues in `src/content/issues/` are examples, labelled as such and using illustrative figures. They exist so the archive can demonstrate itself — five event types across nine regions, so the filters and the full-text search have something real to cut. Delete them before publishing.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
```

| Script                | What it does                                                    |
| --------------------- | --------------------------------------------------------------- |
| `npm run dev`         | Dev server, with drafts visible                                  |
| `npm run build`       | Static build into `dist/`, drafts excluded                       |
| `npm run preview`     | Serve the built site                                             |
| `npm run check`       | TypeScript **and** every issue's frontmatter against the schema  |
| `npm run check:links` | Assert no internal link in `dist/` is broken                     |
| `npm run check:content` | Numbering, charts, market-panel arithmetic, prev/next, facets  |
| `npm run verify`      | All of the above — what CI runs                                  |

---

## Publishing this week's issue

1. **Copy the template.**

   ```bash
   cp src/content/issues/_TEMPLATE.mdx src/content/issues/2026-08-02-a-short-slug.mdx
   ```

   The filename becomes the URL: `/issues/2026-08-02-a-short-slug`. Files starting with `_` are never published.

2. **Fill in the frontmatter.** `regions`, `assets` and `eventType` must match the lists in `src/config/taxonomy.ts` — a typo fails the build with a message naming the file and the allowed values, rather than quietly producing an issue no filter can find. Set `draft: false` when it's ready.

   The `marketMoves` block is the standing panel: the same instruments every week, so consecutive issues read as a series rather than as unrelated facts. `npm run check:content` asserts that each week's levels and percentages compound into the next.

3. **Write the body in Markdown**, then check it:

   ```bash
   npm run verify
   ```

4. **Commit and push.** The homepage now leads with this issue, last week's has moved into the archive, and the RSS feed and search index have both regenerated. Nothing else to do.

Then paste the body into your newsletter platform and send.

### Adding a region, asset class or event type

Edit `src/config/taxonomy.ts`. One line, and the schema, the archive filters and the chip labels all follow.

### Adding a chart

Optional, one per issue. Put the spec in the frontmatter under `chart:` and mark where it goes in the body:

```mdx
<IssueChart chart={frontmatter.chart} />
```

Three types, each in use by at least two issues — which is the test of whether something is a component or a weekly drawing job. A fourth should have to earn its place.

| Type | Shape | For |
| --- | --- | --- |
| `transmission-lag` | Small multiples on a shared time axis | Sequence: which price moves first, which moves last |
| `divergence` | Two series in one unit, the gap shaded | A spread, where the gap itself is the subject |
| `event-track` | One series against a calendar with markers | Timing: which dates moved it |

`type` selects which other fields are required, so a malformed spec fails `npm run check` with the missing field named rather than rendering blank. The renderers are in `src/lib/charts/` and produce plain SVG strings at build time — no chart library, nothing to hydrate, and every value also appears in a "Show the numbers" table so nothing is gated behind hover.

The chart's colour is `--chart-accent` in `src/styles/chart.css`, defaulting to the publication's brass. Any second series is neutral ink rather than a second hue: these charts decode nothing by colour, so one accent is enough.

---

## Turning the newsletter on

The signup form is built and styled but points nowhere yet, so it currently tells readers subscriptions open shortly rather than pretending to collect addresses.

When you've picked a platform, edit **one line** in `src/config/site.ts`:

```ts
export const newsletter: NewsletterConfig = { provider: 'buttondown', handle: 'thedossier' };
// or
export const newsletter: NewsletterConfig = { provider: 'beehiiv', embedUrl: 'https://embeds.beehiiv.com/…' };
```

That's the whole change — no component edits, no layout shift.

Both options keep subscriber addresses off this repository and off any server you run: the platform owns the list, the confirmation email and the unsubscribe link, which is the point of using one. A rough comparison of the two, along with hosting, is in `docs/DEPLOYING.md`.

---

## Layout

```
src/
  config/
    site.ts            Name, tagline, the newsletter switch, archive behaviour
    taxonomy.ts        Regions / assets / event types — single source of truth
  content/
    issues/            One MDX file per issue. _TEMPLATE.mdx is not published.
  content.config.ts    Zod schema validating every issue's frontmatter
  lib/
    issues.ts          Which issue is current, which are archived, date formatting
    paths.ts           Base-aware URL helpers — every internal link goes through these
    charts/            Three SVG renderers + the zod specs that validate them
  components/
    ArchiveExplorer.astro   Search + facet filters (the only interactive component)
    IssueChart.astro        The one visual an issue gets
    MarketMoves.astro       The standing five-instrument panel
    NewsletterForm.astro    Provider-switchable signup
  pages/
    index.astro             This week
    archive.astro           The database
    about.astro             About Us — what this is, and its limits
    issues/[...id].astro    One issue
    search-index.json.ts    Build-time search index
    rss.xml.ts              Full feed
scripts/check-links.mjs     Internal link checker used by CI
scripts/check-content.mjs   Content invariants used by CI (see below)
docs/DEPLOYING.md           How to go live when you're ready
```

### How the archive search works

At build time `search-index.json` is generated from every issue. The archive page renders all cards server-side — so it works with JavaScript disabled and is fully crawlable — and the client script only ever hides and shows those cards as you search and filter. Filter state is mirrored into the URL, so any result set is a shareable link.

If the fetch fails, the complete list stays on screen. There is no server and no database to run.

### What `check:content` guards

`check:links` proves every link resolves. `scripts/check-content.mjs` reads the built HTML and asserts the things that stay *silently* wrong instead of failing a build: an issue that exists as a page but never reached the archive or the search index, a gap in the numbering after a renumber, a chart that disappeared from an issue, a market panel whose weeks stopped compounding into each other, a prev/next chain that lies at one end, and a filter option that would return nothing if a reader picked it.

It reads `dist/` rather than the content collection on purpose — a bug in a page template is exactly what it is for.

---

## Deployment

Not configured yet, on purpose. CI validates every push; nothing is published. `docs/DEPLOYING.md` has ready-to-paste setups for GitHub Pages and Vercel, and CI already proves on every commit that the site survives being served from a subpath — so choosing a host later is a build variable, not a refactor.

---

Built with [Astro](https://astro.build). Analysis on this site is general information, not investment advice.
