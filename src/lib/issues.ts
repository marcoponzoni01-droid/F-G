import { getCollection, type CollectionEntry } from 'astro:content';
import { site } from '../config/site';

export type Issue = CollectionEntry<'issues'>;

/**
 * All publishable issues, newest first.
 *
 * Drafts are visible while running `astro dev` so you can preview next week's
 * issue, and excluded from production builds.
 */
export async function getPublishedIssues(): Promise<Issue[]> {
	const issues = await getCollection('issues', ({ data }) => import.meta.env.DEV || !data.draft);
	return issues.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export interface IssueIndex {
	/** Every published issue, newest first. */
	all: Issue[];
	/** This week's issue — simply the newest one. `null` before the first issue ships. */
	current: Issue | null;
	/** What the archive lists. See `site.archiveIncludesCurrent`. */
	archive: Issue[];
}

/**
 * The whole "newsletter becomes database" rule, in one function.
 *
 * There is no migration step and no published/archived flag to maintain: the
 * newest issue by date *is* the current issue, and everything else *is* the
 * archive. Committing next week's file demotes this week's automatically.
 */
export async function getIssueIndex(): Promise<IssueIndex> {
	const all = await getPublishedIssues();
	return {
		all,
		current: all[0] ?? null,
		archive: site.archiveIncludesCurrent ? all : all.slice(1),
	};
}

/** Previous (older) and next (newer) issue, for in-article navigation. */
export function getNeighbours(all: Issue[], id: string): { older?: Issue; newer?: Issue } {
	const i = all.findIndex((issue) => issue.id === id);
	if (i === -1) return {};
	return { newer: all[i - 1], older: all[i + 1] };
}

/**
 * Dates are formatted in UTC on purpose. A YAML `date: 2026-07-27` parses to
 * UTC midnight, so formatting it in a west-of-UTC local timezone would render
 * the previous day.
 */
export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(date);
}

/** Compact form for cards and lists, e.g. "27 Jul 2026". */
export function formatDateShort(date: Date): string {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC',
	}).format(date);
}

/**
 * The market panel's as-of label, e.g. "Week to 26 Jul".
 *
 * Derived from the issue date rather than stored, so it can never disagree with
 * the issue it sits in.
 */
export function formatWeekOf(date: Date): string {
	const when = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		timeZone: 'UTC',
	}).format(date);
	return `Week to ${when}`;
}

/** Machine-readable YYYY-MM-DD, for <time datetime> and filter comparisons. */
export function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** Strip Markdown to plain text for the search index and meta descriptions. */
export function toPlainText(markdown: string, limit = 1200): string {
	const text = markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/^\s{0,3}>\s?/gm, '')
		.replace(/[*_~]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > limit ? `${text.slice(0, limit)}…` : text;
}
