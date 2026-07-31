import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { ASSETS, EVENT_TYPE_IDS, REGIONS } from './config/taxonomy';

/**
 * One collection holds both services.
 *
 * A weekly newsletter and an archive entry are the same object at different
 * ages, so there is no `status` field and nothing to flip when an issue stops
 * being current — see src/lib/issues.ts.
 *
 * The glob pattern skips underscore-prefixed files so `_TEMPLATE.md` can live
 * beside real issues without being published.
 */
const issues = defineCollection({
	loader: glob({ pattern: '**/[!_]*.md', base: './src/content/issues' }),
	schema: z.object({
		title: z.string().min(1).max(120),
		/** Standfirst: one sentence, shown under the title and in cards. */
		dek: z.string().min(1).max(240),
		/** Week ending. Sole input to ordering and to "which issue is current". */
		date: z.coerce.date(),
		issueNumber: z.number().int().positive(),
		regions: z.array(z.enum(REGIONS)).min(1),
		assets: z.array(z.enum(ASSETS)).min(1),
		eventType: z.enum(EVENT_TYPE_IDS),
		tags: z.array(z.string().min(1)).default([]),
		/** Reused for cards, RSS, and the meta description. */
		summary: z.string().min(1).max(400),
		/** The week's headline price action. Optional — omit for quiet weeks. */
		marketMoves: z
			.array(
				z.object({
					instrument: z.string().min(1),
					change: z.string().min(1),
					note: z.string().optional(),
				}),
			)
			.default([]),
		sources: z
			.array(
				z.object({
					title: z.string().min(1),
					url: z.url(),
				}),
			)
			.default([]),
		/** Visible in `astro dev`, excluded from production builds. */
		draft: z.boolean().default(false),
	}),
});

export const collections = { issues };
