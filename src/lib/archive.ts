import { getIssueIndex, isoDate, toPlainText, type Issue } from './issues';
import { getPublishedStudies, type Study } from './studies';
import { issueHref, studyHref } from './paths';

/**
 * One shape for anything the archive lists.
 *
 * The two collections stay separate where it matters — nothing here can make a
 * study current, and `getIssueIndex()` still knows only about issues. But every
 * surface that *lists* content (the archive, the search index, the feed) wants
 * one array it can sort and filter, so this is where the two are flattened.
 *
 * `eventTypes` is an array for both kinds, an issue contributing its single
 * value. That is what lets the archive's type filter be the same `.includes()`
 * test the region and asset filters already are, instead of a special case.
 */
export interface ArchiveEntry {
	kind: 'issue' | 'study';
	id: string;
	href: string;
	title: string;
	dek: string;
	summary: string;
	/**
	 * Sort key and the date a piece entered the record: an issue's week ending,
	 * a study's *first* publication. Deliberately not a study's revision date —
	 * the archive is a chronology, and editing a two-year-old study should not
	 * make it jump above this week's issue.
	 */
	date: Date;
	/** Set on a revised study only — an issue is never edited after publication. */
	updated?: Date;
	issueNumber?: number;
	subject?: string;
	regions: readonly string[];
	assets: readonly string[];
	eventTypes: readonly string[];
	tags: readonly string[];
	body: string;
}

export function entryFromIssue(issue: Issue): ArchiveEntry {
	return {
		kind: 'issue',
		id: issue.id,
		href: issueHref(issue.id),
		title: issue.data.title,
		dek: issue.data.dek,
		summary: issue.data.summary,
		date: issue.data.date,
		issueNumber: issue.data.issueNumber,
		regions: issue.data.regions,
		assets: issue.data.assets,
		eventTypes: [issue.data.eventType],
		tags: issue.data.tags,
		body: issue.body ?? '',
	};
}

export function entryFromStudy(study: Study): ArchiveEntry {
	return {
		kind: 'study',
		id: study.id,
		href: studyHref(study.id),
		title: study.data.title,
		dek: study.data.dek,
		summary: study.data.summary,
		date: study.data.published,
		updated: study.data.updated,
		subject: study.data.subject,
		regions: study.data.regions,
		assets: study.data.assets,
		eventTypes: study.data.eventTypes,
		tags: study.data.tags,
		body: study.body ?? '',
	};
}

/**
 * Everything the archive holds, newest first.
 *
 * Which issues appear is still `site.archiveIncludesCurrent`'s decision — this
 * reads whatever `getIssueIndex()` calls the archive rather than re-deciding it.
 */
export async function getArchiveEntries(): Promise<ArchiveEntry[]> {
	const [{ archive }, studies] = await Promise.all([getIssueIndex(), getPublishedStudies()]);
	return [...archive.map(entryFromIssue), ...studies.map(entryFromStudy)].sort(
		(a, b) => b.date.valueOf() - a.date.valueOf(),
	);
}

/** Roughly 1,300 words: enough to cover a whole piece for full-text search. */
const INDEXED_BODY_CHARS = 8000;

/** What the client-side search reads. Kept in sync with ArchiveExplorer. */
export interface SearchRecord {
	kind: ArchiveEntry['kind'];
	id: string;
	href: string;
	title: string;
	dek: string;
	summary: string;
	date: string;
	updated?: string;
	issueNumber?: number;
	subject?: string;
	regions: string[];
	assets: string[];
	eventTypes: string[];
	tags: string[];
	body: string;
}

export function toSearchRecord(entry: ArchiveEntry): SearchRecord {
	return {
		kind: entry.kind,
		id: entry.id,
		href: entry.href,
		title: entry.title,
		dek: entry.dek,
		summary: entry.summary,
		date: isoDate(entry.date),
		...(entry.updated ? { updated: isoDate(entry.updated) } : {}),
		...(entry.issueNumber ? { issueNumber: entry.issueNumber } : {}),
		...(entry.subject ? { subject: entry.subject } : {}),
		regions: [...entry.regions],
		assets: [...entry.assets],
		eventTypes: [...entry.eventTypes],
		tags: [...entry.tags],
		body: toPlainText(entry.body, INDEXED_BODY_CHARS),
	};
}
