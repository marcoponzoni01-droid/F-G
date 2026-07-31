# The Dossier

**The financial anatomy of geopolitical events.**

A publication with two services that are really one thing:

1. **Newsletter** — one issue a week on how the week's geopolitical events moved capital.
2. **Database** — a permanent, searchable archive of every issue, filterable by region, asset class, event type and date.

The central idea: **a newsletter issue and an archive entry are the same object at different ages.** There is no "move to archive" step, no published/archived flag, nothing to remember. Each issue is one Markdown file, and the newest date is the current issue. Commit next week's file and last week's demotes itself.

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
| `npm run verify`      | All three — what CI runs                                         |

---

## Publishing this week's issue

1. **Copy the template.**

   ```bash
   cp src/content/issues/_TEMPLATE.md src/content/issues/2026-08-02-a-short-slug.md
   ```

   The filename becomes the URL: `/issues/2026-08-02-a-short-slug`. Files starting with `_` are never published.

2. **Fill in the frontmatter.** `regions`, `assets` and `eventType` must match the lists in `src/config/taxonomy.ts` — a typo fails the build with a message naming the file and the allowed values, rather than quietly producing an issue no filter can find. Set `draft: false` when it's ready.

3. **Write the body in Markdown**, then check it:

   ```bash
   npm run verify
   ```

4. **Commit and push.** The homepage now leads with this issue, last week's has moved into the archive, and the RSS feed and search index have both regenerated. Nothing else to do.

Then paste the body into your newsletter platform and send.

### Adding a region, asset class or event type

Edit `src/config/taxonomy.ts`. One line, and the schema, the archive filters and the chip labels all follow.

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
    issues/            One Markdown file per issue. _TEMPLATE.md is not published.
  content.config.ts    Zod schema validating every issue's frontmatter
  lib/
    issues.ts          Which issue is current, which are archived, date formatting
    paths.ts           Base-aware URL helpers — every internal link goes through these
  components/
    ArchiveExplorer.astro   Search + facet filters (the only interactive component)
    NewsletterForm.astro    Provider-switchable signup
  pages/
    index.astro             This week
    archive.astro           The database
    issues/[...id].astro    One issue
    search-index.json.ts    Build-time search index
    rss.xml.ts              Full feed
scripts/check-links.mjs     Internal link checker used by CI
docs/DEPLOYING.md           How to go live when you're ready
```

### How the archive search works

At build time `search-index.json` is generated from every issue. The archive page renders all cards server-side — so it works with JavaScript disabled and is fully crawlable — and the client script only ever hides and shows those cards as you search and filter. Filter state is mirrored into the URL, so any result set is a shareable link.

If the fetch fails, the complete list stays on screen. There is no server and no database to run.

---

## Deployment

Not configured yet, on purpose. CI validates every push; nothing is published. `docs/DEPLOYING.md` has ready-to-paste setups for GitHub Pages and Vercel, and CI already proves on every commit that the site survives being served from a subpath — so choosing a host later is a build variable, not a refactor.

---

Built with [Astro](https://astro.build). Analysis on this site is general information, not investment advice.
