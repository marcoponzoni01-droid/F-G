# Deploying

Nothing is published yet — by choice. CI builds and validates every push, but no
host is configured. This document is the whole cost of that deferral: pick an
option below and you are live in a few minutes.

The site is a pile of static files. Any static host works; these two are just
the paths with the least friction.

---

## Option A — GitHub Pages

Free forever on a public repository, no new accounts, and it stays free if the
publication ever earns money. The ceiling is that Pages can only serve static
files — fine for everything this site does today, and a wall only if you later
want your own subscriber database or member logins.

### 1. Add the workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run check
      - name: Build
        env:
          # A *project* site lives at https://<user>.github.io/<repo>, so the
          # base path is required. On a custom domain, drop BASE_PATH entirely.
          SITE_URL: https://marcoponzoni01-droid.github.io
          BASE_PATH: /F-G
        run: npm run build
      - run: BASE_PATH=/F-G npm run check:links
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### 2. Flip the one setting only you can flip

**Repo → Settings → Pages → Build and deployment → Source: “GitHub Actions.”**

Until this is set the workflow runs green but publishes nothing. This is the
single most common reason a Pages deploy appears to “work” yet shows a 404.

### 3. Push to `main`

The site appears at `https://marcoponzoni01-droid.github.io/F-G/`.

### Custom domain later

Add the domain under Settings → Pages, create a `public/CNAME` file containing
the bare domain, then **remove `BASE_PATH`** from the workflow and set
`SITE_URL` to the new domain. The site moves from `/F-G/` to `/`, and because
every link is built through `src/lib/paths.ts` nothing else needs editing.

---

## Option B — Vercel

More capable: server code, per-pull-request preview URLs, instant rollback.
Free on the Hobby plan while the site is personal and non-commercial — Vercel's
terms require a paid plan once it carries ads, sponsorships or paid
subscriptions.

1. Sign in to Vercel and import the repository.
2. Vercel detects Astro automatically. Confirm the settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add one environment variable — `SITE_URL` = your production URL (e.g.
   `https://thedossier.vercel.app` or your custom domain).
   Do **not** set `BASE_PATH`; Vercel serves from the domain root.
4. Deploy.

---

## Which to pick

Start on **Pages**. Moving Pages → Vercel later is an import and a DNS record;
choosing Vercel now means either paying the day the site earns anything, or
migrating anyway. Pages' static-only limit does not bind until you want
features this site does not currently have.

---

## The two environment variables

Both are read in `astro.config.mjs`. Neither is secret.

| Variable    | Default                 | Purpose                                                                                |
| ----------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `SITE_URL`  | `http://localhost:4321` | Origin for canonical tags, Open Graph URLs, the sitemap and RSS links.                  |
| `BASE_PATH` | `/`                     | Subpath the site is served from. Required for a GitHub Pages *project* site; not for a custom domain or Vercel. |

Verify a subpath build locally at any time:

```bash
BASE_PATH=/F-G npm run build && BASE_PATH=/F-G npm run check:links
```

CI runs exactly this on every push, so a link that would break under a subpath
fails before you ever pick a host.
