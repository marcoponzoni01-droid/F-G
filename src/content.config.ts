import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { ASSETS, EVENT_TYPE_IDS, REGIONS } from './config/taxonomy';
import { chartSchema } from './lib/charts/types';

/** Sources are the same shape wherever they appear. */
const sources = z
	.array(
		z.object({
			title: z.string().min(1),
			url: z.url(),
		}),
	)
	.default([]);

/**
 * The weekly newsletter, which is also the archive's spine.
 *
 * A newsletter issue and an archive entry are the same object at different
 * ages, so there is no `status` field and nothing to flip when an issue stops
 * being current — see src/lib/issues.ts.
 *
 * The glob pattern skips underscore-prefixed files so `_TEMPLATE.mdx` can live
 * beside real issues without being published.
 */
const issues = defineCollection({
	loader: glob({ pattern: '**/[!_]*.{md,mdx}', base: './src/content/issues' }),
	schema: z.object({
		title: z.string().min(1).max(120),
		/** Standfirst: one sentence, shown under the title and in cards. */
		dek: z.string().min(1).max(240),
		/** Week ending. Sole input to ordering and to "which issue is current". */
		date: z.coerce.date(),
		issueNumber: z.number().int().positive(),
		regions: z.array(z.enum(REGIONS)).min(1),
		assets: z.array(z.enum(ASSETS)).min(1),
		/**
		 * Singular, on purpose.
		 *
		 * An issue is one piece about one thing — not a bulletin of separate
		 * segments — so it transmits through one channel and the filters describe
		 * the whole issue. If an issue ever needs two, that is two issues.
		 */
		eventType: z.enum(EVENT_TYPE_IDS),
		tags: z.array(z.string().min(1)).default([]),
		/** Reused for cards, RSS, and the meta description. */
		summary: z.string().min(1).max(400),
		/**
		 * The week's price action. Optional — omit for quiet weeks.
		 *
		 * `level` carries the close as it should publish, formatted, because a
		 * number here would be re-formatted by whatever locale the build ran in.
		 * `note` is for a story-specific mover shown alongside the standing panel.
		 */
		marketMoves: z
			.array(
				z.object({
					instrument: z.string().min(1),
					level: z.string().min(1).optional(),
					change: z.string().min(1),
					note: z.string().optional(),
				}),
			)
			.default([]),
		/** Footnote under the panel, e.g. a provenance or estimate caveat. */
		marketMovesNote: z.string().optional(),
		/** One chart, placed in the body with `<IssueChart chart={frontmatter.chart} />`. */
		chart: chartSchema.optional(),
		sources,
		/** Visible in `astro dev`, excluded from production builds. */
		draft: z.boolean().default(false),
	}),
});

/**
 * Studies — the archive's other half.
 *
 * A separate collection rather than a `kind` field on `issues`, for two
 * reasons.
 *
 * The first is maintenance, and it is an editorial rule rather than a technical
 * one. An issue is a record: it reports a week and is never edited afterwards,
 * because a record you revise after the fact is not worth keeping. A study is
 * reference: a piece on a country's debt that is never brought up to date is
 * worse than no piece. `updated` exists here and nowhere else, and the About
 * page states the distinction.
 *
 * The second is structural. `getIssueIndex()` defines the current issue as the
 * newest thing by date. If studies shared that collection, publishing one would
 * silently take over the homepage — so they do not share it, and the separation
 * is enforced by the type system rather than by a filter someone must remember.
 *
 * What they *do* share is the taxonomy, the archive, the search index and the
 * chart component. The database was never meant to be two libraries.
 */
const studies = defineCollection({
	loader: glob({ pattern: '**/[!_]*.{md,mdx}', base: './src/content/studies' }),
	schema: z.object({
		title: z.string().min(1).max(120),
		dek: z.string().min(1).max(240),
		summary: z.string().min(1).max(400),
		/** What the study is about — "Italy", "Central bank independence". */
		subject: z.string().min(1).max(60),
		/** Drives the grouping on /studies. */
		subjectKind: z.enum(['country', 'mechanism']),
		regions: z.array(z.enum(REGIONS)).min(1),
		assets: z.array(z.enum(ASSETS)).min(1),
		/**
		 * Plural, where an issue's is singular.
		 *
		 * An issue covers one event and therefore one transmission channel. A
		 * study explains a structure that several channels run through, and
		 * forcing it to pick one would make it unfindable under the others.
		 */
		eventTypes: z.array(z.enum(EVENT_TYPE_IDS)).min(1),
		tags: z.array(z.string().min(1)).default([]),
		published: z.coerce.date(),
		/** Set when the piece is revised. Shown as "Updated …"; issues never have it. */
		updated: z.coerce.date().optional(),
		chart: chartSchema.optional(),
		sources,
		draft: z.boolean().default(false),
	}),
});

export const collections = { issues, studies };
