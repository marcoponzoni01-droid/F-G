import type { APIRoute } from 'astro';
import { getArchiveEntries, toSearchRecord, type SearchRecord } from '../lib/archive';

export type { SearchRecord };

/**
 * The search index, generated at build time.
 *
 * This is what stands in for a database query engine: a weekly publication adds
 * ~52 records a year, so the whole corpus stays comfortably small enough to
 * search in the browser for many years. No server, no API, no query latency.
 *
 * It covers both kinds the archive holds — weekly issues and studies — because
 * a reader searching for a remembered phrase does not know, and should not need
 * to know, which of the two they are about to find. The record shape is
 * normalised in src/lib/archive.ts.
 *
 * The index is fetched lazily, after the page has rendered, and compresses well
 * over the wire. If it ever does grow unwieldy — several years in, or if issues
 * get much longer — the migration is to a prebuilt inverted index such as
 * Pagefind, which shards the index and fetches only the shards a query needs.
 */
export const GET: APIRoute = async () => {
	const entries = await getArchiveEntries();

	return new Response(JSON.stringify(entries.map(toSearchRecord)), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
};
