import type { APIRoute } from 'astro';
import { getIssueIndex, isoDate, toPlainText } from '../lib/issues';

export interface SearchRecord {
	id: string;
	title: string;
	dek: string;
	summary: string;
	date: string;
	issueNumber: number;
	regions: string[];
	assets: string[];
	eventType: string;
	tags: string[];
	body: string;
}

/**
 * The search index, generated at build time.
 *
 * This is what stands in for a database query engine: a weekly publication adds
 * ~52 records a year, so the whole corpus stays comfortably small enough to
 * search in the browser for many years. No server, no API, no query latency.
 *
 * The index is fetched lazily, after the page has rendered, and compresses well
 * over the wire. If it ever does grow unwieldy — several years in, or if issues
 * get much longer — the migration is to a prebuilt inverted index such as
 * Pagefind, which shards the index and fetches only the shards a query needs.
 */

/** Roughly 1,300 words: enough to cover a whole issue for full-text search. */
const INDEXED_BODY_CHARS = 8000;

export const GET: APIRoute = async () => {
	const { archive } = await getIssueIndex();

	const records: SearchRecord[] = archive.map((issue) => ({
		id: issue.id,
		title: issue.data.title,
		dek: issue.data.dek,
		summary: issue.data.summary,
		date: isoDate(issue.data.date),
		issueNumber: issue.data.issueNumber,
		regions: [...issue.data.regions],
		assets: [...issue.data.assets],
		eventType: issue.data.eventType,
		tags: [...issue.data.tags],
		body: toPlainText(issue.body ?? '', INDEXED_BODY_CHARS),
	}));

	return new Response(JSON.stringify(records), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
};
