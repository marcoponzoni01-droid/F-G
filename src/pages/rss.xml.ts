import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getArchiveEntries } from '../lib/archive';
import { isoDate } from '../lib/issues';
import { site } from '../config/site';
import { href } from '../lib/paths';

/**
 * One feed for both kinds.
 *
 * The emailed newsletter stays strictly the weekly issue — that is the promise
 * on the signup form and a study arriving in an inbox would break it. The feed
 * has made no such promise, and a reader who subscribed to follow the
 * publication wants the studies too.
 */
export async function GET(context: APIContext) {
	const entries = await getArchiveEntries();

	return rss({
		title: site.name,
		description: site.description,
		site: context.site ?? new URL(href('/'), context.url),
		trailingSlash: false,
		items: entries.map((entry) => ({
			title:
				entry.kind === 'issue'
					? `No. ${entry.issueNumber} — ${entry.title}`
					: `Study · ${entry.subject} — ${entry.title}`,
			description: entry.summary,
			pubDate: entry.date,
			link: entry.href,
			categories: [entry.kind, ...entry.eventTypes, ...entry.regions, ...entry.assets, ...entry.tags],
			customData: `<dc:date>${isoDate(entry.date)}</dc:date>`,
		})),
		xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
		customData: `<language>en</language>`,
	});
}
