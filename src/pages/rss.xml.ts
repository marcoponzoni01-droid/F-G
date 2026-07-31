import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedIssues, isoDate } from '../lib/issues';
import { site } from '../config/site';
import { href } from '../lib/paths';

export async function GET(context: APIContext) {
	const issues = await getPublishedIssues();

	return rss({
		title: site.name,
		description: site.description,
		site: context.site ?? new URL(href('/'), context.url),
		trailingSlash: false,
		items: issues.map((issue) => ({
			title: `No. ${issue.data.issueNumber} — ${issue.data.title}`,
			description: issue.data.summary,
			pubDate: issue.data.date,
			link: href(`/issues/${issue.id}`),
			categories: [
				issue.data.eventType,
				...issue.data.regions,
				...issue.data.assets,
				...issue.data.tags,
			],
			customData: `<dc:date>${isoDate(issue.data.date)}</dc:date>`,
		})),
		xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
		customData: `<language>en</language>`,
	});
}
