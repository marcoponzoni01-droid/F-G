---
# Copy this file to src/content/issues/YYYY-MM-DD-a-short-slug.md and fill it in.
# The filename's slug becomes the URL: /issues/2026-08-02-a-short-slug
# Files starting with an underscore are never published, so this one is safe here.

title: 'Headline, under 120 characters'
dek: 'One sentence under the title. What happened, and why it costs someone money.'

# Week ending. This single field decides which issue is "current" — the newest
# date wins and everything older falls into the archive automatically.
date: 2026-08-02
issueNumber: 3

# Must match the lists in src/config/taxonomy.ts exactly. A typo fails the
# build with a message naming the file and the allowed values.
regions: [Global]
assets: [Equities]
eventType: conflict

tags: [free-text, no-validation-here]

summary: >-
  One paragraph. Reused on cards, in the RSS feed and as the page's meta
  description, so write it to stand alone.

# The week's headline price action. Delete the whole block for a quiet week.
marketMoves:
  - { instrument: 'Brent', change: '+4.2%', note: 'risk premium, not lost supply' }
  - { instrument: 'EUR/USD', change: '-0.8%' }

sources:
  - { title: 'Name of source', url: 'https://example.com' }

# true keeps it visible in `npm run dev` but out of production builds.
draft: true
---

Open with the event in a sentence or two. Assume the reader saw the headline and
wants the financial consequence.

## What moved

The price action, and whether it reflects a genuine change in supply, demand or
risk — or just positioning.

## Why it moved

The transmission mechanism. This is the part readers cannot get from a news wire.

## What to watch

The specific, checkable thing that would confirm or refute the read.
