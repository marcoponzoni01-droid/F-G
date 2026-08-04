import { getCollection, type CollectionEntry } from 'astro:content';

export type Study = CollectionEntry<'studies'>;

/**
 * Studies, newest first by publication date.
 *
 * Deliberately not merged into `getIssueIndex()`. Nothing here can ever become
 * "this week's issue", and keeping the two queries apart is what guarantees it —
 * see the note on the collection in src/content.config.ts.
 */
export async function getPublishedStudies(): Promise<Study[]> {
	const studies = await getCollection('studies', ({ data }) => import.meta.env.DEV || !data.draft);
	return studies.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
}

/**
 * The date a reader should *see*: when it was last revised, else when it ran.
 *
 * Not the date anything sorts by — see the note on `date` in src/lib/archive.ts.
 * What a reader of reference material needs is how stale it might be; what the
 * archive needs is a stable chronology. Those are different questions.
 */
export function displayDate(study: Study): Date {
	return study.data.updated ?? study.data.published;
}

export const SUBJECT_KINDS = [
	{ id: 'country', label: 'Countries', blurb: 'How one economy transmits a shock.' },
	{ id: 'mechanism', label: 'Mechanisms', blurb: 'How one channel works, wherever it runs.' },
] as const;

export type SubjectKind = (typeof SUBJECT_KINDS)[number]['id'];

/** Grouped for the /studies index, in the order declared above. */
export function groupBySubjectKind(studies: Study[]): { kind: (typeof SUBJECT_KINDS)[number]; studies: Study[] }[] {
	return SUBJECT_KINDS.map((kind) => ({
		kind,
		studies: studies.filter((study) => study.data.subjectKind === kind.id),
	})).filter((group) => group.studies.length > 0);
}
