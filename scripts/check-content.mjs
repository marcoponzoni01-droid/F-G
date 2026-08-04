#!/usr/bin/env node
/**
 * Content invariants for the built site.
 *
 * check-links.mjs proves every link resolves. This proves the things that stay
 * silently wrong when they break: an issue that exists as a page but never made
 * it into the archive or the search index, a numbering gap after a renumber, a
 * chart that vanished from an issue, a market panel whose weeks no longer
 * compound into each other, or a prev/next chain that lies at one end.
 *
 * Deliberately reads dist/ rather than the content collection, because what a
 * reader gets is the built HTML — a bug in a page template is exactly the kind
 * this is meant to catch.
 *
 * Run after `npm run build`. No network access, no dependencies.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');

/** Charts each issue is expected to carry. A chart silently lost is a regression. */
const EXPECTED_CHARTS = {
	'2026-07-26-red-sea-reroutes': 'transmission-lag',
	'2026-07-19-sanctions-designation-gap': 'divergence',
	'2026-07-12-substitution-clock': 'divergence',
	'2026-07-05-election-premium': 'event-track',
	'2026-06-28-storage-is-the-constraint': 'event-track',
	'2026-06-21-borrowed-short-invested-long': 'divergence',
	'2026-06-14-the-rate-that-served-the-peg': 'event-track',
	'2026-06-07-the-embargo-and-the-lag': 'transmission-lag',
};

/**
 * Issues whose chart plots real published data rather than invented figures.
 *
 * These must name their sources on the chart itself. A historical chart that
 * silently fell back to the "illustrative" badge would be understating what it
 * is; one that kept a real-sources note after its data was replaced would be
 * overstating it. Both are misrepresentation, and neither breaks the build.
 */
const SOURCED_CHARTS = [
	'2026-06-21-borrowed-short-invested-long',
	'2026-06-14-the-rate-that-served-the-peg',
	'2026-06-07-the-embargo-and-the-lag',
];

const failures = [];
let checks = 0;

function check(label, condition, detail = '') {
	checks++;
	if (!condition) failures.push(detail ? `${label} — ${detail}` : label);
}

const read = (rel) => readFile(path.join(DIST, rel), 'utf8');

/** All matches of a capturing group, in document order. */
function all(html, pattern) {
	return [...html.matchAll(pattern)].map((m) => m[1]);
}

/**
 * The five entities Astro emits. Attribute values are encoded in the HTML, so
 * "Russia & CIS" reaches this script as "Russia &amp; CIS" and would never match
 * the taxonomy it came from.
 */
function decode(html) {
	return html
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#8202;|&nbsp;/g, ' ')
		.replace(/&amp;/g, '&');
}

/** Text content with tags stripped and whitespace collapsed. */
function text(html) {
	return decode(html.replace(/<[^>]+>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();
}

// ── Gather ────────────────────────────────────────────────────────────────
const issueDirs = (await readdir(path.join(DIST, 'issues'), { withFileTypes: true }))
	.filter((e) => e.isDirectory())
	.map((e) => e.name)
	.sort()
	.reverse(); // newest first, since the slugs start with the date

const issues = [];
for (const slug of issueDirs) {
	const html = await read(path.join('issues', slug, 'index.html'));
	const numberMatch = html.match(/No\.\s*(\d+)/);
	const dateMatch = html.match(/<time datetime="(\d{4}-\d{2}-\d{2})"/);
	issues.push({
		slug,
		html,
		number: numberMatch ? Number(numberMatch[1]) : null,
		date: dateMatch ? dateMatch[1] : null,
	});
}

const studyDirs = (await readdir(path.join(DIST, 'studies'), { withFileTypes: true }))
	.filter((e) => e.isDirectory())
	.map((e) => e.name)
	.sort();

const studies = [];
for (const slug of studyDirs) {
	studies.push({ slug, html: await read(path.join('studies', slug, 'index.html')) });
}

const home = await read('index.html');
const archive = await read(path.join('archive', 'index.html'));
const studiesIndex = await read(path.join('studies', 'index.html'));
const index = JSON.parse(await read('search-index.json'));

const indexed = {
	issues: index.filter((r) => r.kind === 'issue'),
	studies: index.filter((r) => r.kind === 'study'),
};

// ── 1. Every issue exists in all three places ─────────────────────────────
check('at least one issue is published', issues.length > 0);

const archiveCards = all(archive, /href="[^"]*\/issues\/([^"/]+)\/?"/g);
const uniqueCards = [...new Set(archiveCards)];

check(
	'archive lists every issue',
	uniqueCards.length === issues.length,
	`${uniqueCards.length} linked, ${issues.length} built`,
);

check(
	'search index covers every issue',
	indexed.issues.length === issues.length,
	`${indexed.issues.length} issue records, ${issues.length} issues`,
);

for (const issue of issues) {
	check(
		`archive links ${issue.slug}`,
		uniqueCards.includes(issue.slug),
		'built but not reachable from /archive',
	);
	check(
		`search index contains ${issue.slug}`,
		index.some((record) => record.id === issue.slug),
		'a reader searching for it would find nothing',
	);
}

// ── 1b. Studies reach the same three places ───────────────────────────────
// A study that exists as a page but never made the archive or the index is the
// exact failure the second collection was meant to avoid: two libraries.
const archiveStudyCards = [...new Set(all(archive, /href="[^"]*\/studies\/([^"/]+)\/?"/g))];

check(
	'search index covers every study',
	indexed.studies.length === studies.length,
	`${indexed.studies.length} study records, ${studies.length} studies`,
);

for (const study of studies) {
	check(
		`archive links ${study.slug}`,
		archiveStudyCards.includes(study.slug),
		'a study missing from the archive is a second library',
	);
	check(
		`/studies links ${study.slug}`,
		studiesIndex.includes(`/studies/${study.slug}`),
		'built but not reachable from its own index',
	);
	check(
		`search index contains ${study.slug}`,
		index.some((record) => record.id === study.slug),
		'a reader searching for it would find nothing',
	);
}

// A card is a grid item, so an unbreakable child widens its whole column and
// every sibling with it. A study subject can be a sentence, so its eyebrow must
// be allowed to wrap — this once pushed the archive 13px sideways on a phone.
check(
	'study card eyebrows can wrap',
	!/class="label whitespace-nowrap text-accent"/.test(archive),
	'a nowrap eyebrow will widen the grid column it sits in',
);

// Studies are not numbered, and never claim to be an issue.
for (const record of indexed.studies) {
	check(
		`${record.id} carries a subject`,
		Boolean(record.subject),
		'a study is indexed by what it is about',
	);
	check(`${record.id} is not numbered`, record.issueNumber === undefined, String(record.issueNumber));
}

// "Updated" appears only where the frontmatter set it, and never on an issue.
for (const study of studies) {
	const record = indexed.studies.find((r) => r.id === study.slug);
	const shows = /\bUpdated\b/.test(text(study.html));
	check(
		`${study.slug} shows "Updated" iff it has been revised`,
		shows === Boolean(record?.updated),
		record?.updated ? 'revised but not stated' : 'states a revision it never had',
	);
}

for (const issue of issues) {
	check(
		`${issue.slug} never claims a revision`,
		!/\bUpdated\b/.test(text(issue.html)),
		'an issue is a record and is not edited after publication',
	);
}

// ── 1c. Every issue opens with a recap ────────────────────────────────────
for (const issue of issues) {
	const block = issue.html.match(/<section[^>]*data-key-points[\s\S]*?<\/section>/);
	check(`${issue.slug} opens with a recap`, Boolean(block), 'no key-points block');
	if (!block) continue;

	const points = all(block[0], /<li class="key-point[^"]*">([^<]+)<\/li>/g).map(decode);
	check(`${issue.slug} recap is 3 to 5 points`, points.length >= 3 && points.length <= 5, String(points.length));

	// Phrases, not sentences: a full stop means someone wrote prose here.
	const sentences = points.filter((p) => /\.\s*$/.test(p));
	check(`${issue.slug} recap points are phrases`, sentences.length === 0, sentences.join(' | '));

	// "Better if they have numbers inside" — not every line can carry one, but a
	// recap without any figures is a paraphrase of the argument, not a summary
	// of what the piece found.
	const withFigures = points.filter((p) => /\d/.test(p));
	check(
		`${issue.slug} recap is mostly figures`,
		withFigures.length >= Math.ceil(points.length / 2),
		`${withFigures.length} of ${points.length} carry a number`,
	);

	// It has to come before the article, or it is not a recap.
	const recapAt = issue.html.indexOf('data-key-points');
	const proseAt = issue.html.indexOf('class="prose');
	check(`${issue.slug} recap precedes the body`, recapAt > 0 && recapAt < proseAt);
}

// ── 2. Numbering is contiguous and agrees with date order ─────────────────
const numbers = issues.map((i) => i.number);
check('every issue states its number', numbers.every(Number.isInteger), String(numbers));

const descending = [...numbers].every((n, i) => i === 0 || numbers[i - 1] === n + 1);
check(
	'issue numbers descend by one, newest first',
	descending,
	`got ${numbers.join(', ')} for ${issues.map((i) => i.date).join(', ')}`,
);

check('numbering starts at 1', Math.min(...numbers) === 1, `lowest is ${Math.min(...numbers)}`);

const dates = issues.map((i) => i.date);
check(
	'dates descend with the numbering',
	[...dates].every((d, i) => i === 0 || dates[i - 1] > d),
	dates.join(', '),
);

// The homepage hero is the newest issue — the rollover rule, observed from
// outside. Nothing flips a flag to make this true; it falls out of the dates.
check(
	'homepage hero is the newest issue',
	home.includes(`/issues/${issues[0].slug}`) && home.includes(`No. ${issues[0].number}`),
	`expected No. ${issues[0].number} · ${issues[0].slug}`,
);

// ── 3. One chart per issue, of the expected type ──────────────────────────
for (const issue of issues) {
	const charts = all(issue.html, /<figure class="issue-chart" data-chart="([a-z-]+)"/g);
	const expected = EXPECTED_CHARTS[issue.slug];
	if (!expected) continue;
	check(`${issue.slug} has exactly one chart`, charts.length === 1, `found ${charts.length}`);
	check(`${issue.slug} chart is ${expected}`, charts[0] === expected, `found ${charts[0]}`);

	// A chart with no marks is a rendering failure that still looks like success.
	check(
		`${issue.slug} chart draws a series`,
		/class="ic-line"/.test(issue.html),
		'no plotted line in the SVG',
	);
	check(
		`${issue.slug} chart offers the numbers`,
		issue.html.includes('Show the numbers'),
		'no table view, so hover would be the only way to read a value',
	);
	check(
		`${issue.slug} chart is described`,
		/<desc id="d-[a-z0-9-]+">[^<]{40,}<\/desc>/.test(issue.html),
		'missing or too-short <desc> for a reader who cannot see it',
	);
}

// Provenance says what kind of number the reader is looking at.
for (const issue of issues) {
	if (!EXPECTED_CHARTS[issue.slug]) continue;
	const note = issue.html.match(/data-provenance>([^<]+)</)?.[1] ?? '';
	const sourced = SOURCED_CHARTS.includes(issue.slug);
	check(`${issue.slug} chart states its provenance`, note.length > 0, 'no provenance note');
	check(
		`${issue.slug} chart is labelled ${sourced ? 'sourced' : 'illustrative'}`,
		sourced ? !/illustrative/i.test(note) : /illustrative/i.test(note),
		`reads "${note.slice(0, 70)}"`,
	);
	if (sourced) {
		// A sourced chart with no external links is unverifiable by the reader.
		const links = (issue.html.match(/rel="noopener noreferrer external"/g) ?? []).length;
		check(`${issue.slug} cites sources a reader can follow`, links >= 2, `${links} source links`);
	}
}

// A divergence chart must draw both series and the band between them.
const divergences = issues.filter((i) => EXPECTED_CHARTS[i.slug] === 'divergence');
for (const issue of divergences) {
	check(
		`${issue.slug} divergence draws a reference series`,
		/class="ic-line-ref"/.test(issue.html),
		'second series missing',
	);
	check(
		`${issue.slug} divergence shades the gap`,
		/class="ic-gap"/.test(issue.html),
		'the gap is the subject of this chart type',
	);
	check(
		`${issue.slug} divergence names both series`,
		(issue.html.match(/class="ic-legend-label"/g) ?? []).length === 2,
		'legend does not carry two keys',
	);
}

// An event-track's markers must run left to right, or the calendar is scrambled.
for (const issue of issues.filter((i) => EXPECTED_CHARTS[i.slug] === 'event-track')) {
	const xs = all(issue.html, /<circle class="ic-marker" cx="([\d.]+)"/g).map(Number);
	check(`${issue.slug} event-track has markers`, xs.length >= 2, `found ${xs.length}`);
	check(
		`${issue.slug} markers ascend`,
		xs.every((x, i) => i === 0 || x > xs[i - 1]),
		xs.join(', '),
	);

	// Marker labels must not sit on top of each other. Decisive dates cluster —
	// three of them days apart on an axis spanning years is the normal case, not
	// the edge case — and the renderer staggers them onto extra rows to cope. If
	// that stagger ever stops working the chart still renders, still passes every
	// other check, and is unreadable.
	const labels = [
		...issue.html.matchAll(
			/<text class="ic-marker-label" x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]+)<\/text>/g,
		),
	].map((m) => ({ x: Number(m[1]), y: Number(m[2]), text: decode(m[3]) }));

	check(`${issue.slug} every marker is labelled`, labels.length === xs.length);

	for (const [i, a] of labels.entries()) {
		for (const b of labels.slice(i + 1)) {
			if (a.y !== b.y) continue;
			// Same estimate the renderer lays out with, so the check tracks the fix.
			const gap = Math.abs(b.x - a.x);
			const needed = ((a.text.length + b.text.length) / 2) * 6.2;
			check(
				`${issue.slug} labels "${a.text}" and "${b.text}" do not overlap`,
				gap >= needed,
				`${gap.toFixed(0)} units apart, need ${needed.toFixed(0)}`,
			);
		}
	}
}

// ── 4. The market panel compounds week to week ────────────────────────────
// Each issue quotes a level and a week-over-week change. Consecutive issues must
// therefore agree: last week's level, moved by this week's change, is this
// week's level. Hand-written numbers drift apart silently; this catches it.
//
// Read from the frontmatter rather than dist, uniquely in this file. The panel
// renders on the homepage only — for whichever issue is current — so the built
// site never shows two consecutive weeks at once and the chain cannot be
// checked from it. The invariant is about the data being coherent, not about
// where it is drawn, so the source is the right place to look.
const SOURCE = path.resolve('src/content/issues');

function panelFromSource(slug) {
	const file = path.join(SOURCE, `${slug}.mdx`);
	if (!existsSync(file)) return null;
	const front = readFileSync(file, 'utf8').split('---')[1] ?? '';
	const block = front.match(/\nmarketMoves:\n([\s\S]*?)\n[a-zA-Z]/);
	if (!block) return null;
	return [...block[1].matchAll(/instrument:\s*'([^']+)'.*?(?:level:\s*'([^']+)')?.*?change:\s*'([^']+)'/g)].map(
		(m) => ({
			instrument: m[1],
			level: m[2] ? Number(m[2].replace(/,/g, '')) : null,
			change: Number(m[3].replace('−', '-').replace('%', '')),
		}),
	);
}

const panels = issues.map((issue) => ({ slug: issue.slug, rows: panelFromSource(issue.slug) }));
for (const { slug, rows } of panels) {
	check(`${slug} carries a market panel in its frontmatter`, rows !== null && rows.length > 0);
}

// …and it must not render on the issue page. The panel belongs to "this week";
// an archived issue showing months-old levels invites a reader to trade on them.
for (const issue of issues) {
	check(
		`${issue.slug} does not render a market panel`,
		!issue.html.includes('data-market-moves'),
		'the standing panel is the homepage’s, not the article’s',
	);
}

check(
	'the homepage does render one',
	home.includes('data-market-moves'),
	'the panel has to live somewhere',
);

for (let i = 0; i < panels.length - 1; i++) {
	const newer = panels[i];
	const older = panels[i + 1];
	if (!newer.rows || !older.rows) continue;
	check(
		`${newer.slug} panel lists the same instruments as ${older.slug}`,
		newer.rows.map((r) => r.instrument).join('|') === older.rows.map((r) => r.instrument).join('|'),
		'a standing panel that changes constituents is not a series',
	);
	for (const [k, row] of newer.rows.entries()) {
		const previous = older.rows[k];
		if (!row.level || !previous?.level || row.change === null) continue;
		const implied = previous.level * (1 + row.change / 100);
		const drift = Math.abs(implied - row.level) / row.level;
		check(
			`${newer.slug} ${row.instrument} compounds from ${older.slug}`,
			drift < 0.001,
			`${previous.level} ${row.change > 0 ? '+' : ''}${row.change}% → ${implied.toFixed(2)}, quoted ${row.level}`,
		);
	}
}

// ── 5. The prev/next chain is right at both ends and in the middle ────────
for (const [i, issue] of issues.entries()) {
	const nav = issue.html.match(/<nav aria-label="Other issues"[\s\S]*?<\/nav>/)?.[0] ?? '';
	const newer = issues[i - 1];
	const older = issues[i + 1];

	check(
		`${issue.slug} ${newer ? 'links' : 'omits'} Newer`,
		newer ? nav.includes(`/issues/${newer.slug}`) : !nav.includes('← Newer'),
		newer ? `expected a link to ${newer.slug}` : 'newest issue should have nothing newer',
	);
	check(
		`${issue.slug} ${older ? 'links' : 'omits'} Older`,
		older ? nav.includes(`/issues/${older.slug}`) : !nav.includes('Older →'),
		older ? `expected a link to ${older.slug}` : 'oldest issue should have nothing older',
	);
}

// ── 6. Facets can actually cut the archive ────────────────────────────────
// An archive whose filters all return everything is a list with extra steps.
for (const facet of ['eventTypes', 'regions', 'assets', 'kind']) {
	const values = new Set(index.flatMap((r) => [r[facet]].flat().filter(Boolean)));
	check(`archive offers more than one ${facet}`, values.size > 1, [...values].join(', '));
}

// Every value the filter controls offer must match at least one entry, or the
// reader picks it and gets an empty page.
const options = all(archive, /<option value="([^"]+)"/g)
	.map(decode)
	.filter((v) => v && v !== 'all');
for (const value of new Set(options)) {
	const matches = index.some((r) =>
		[r.kind, ...(r.eventTypes ?? []), ...(r.regions ?? []), ...(r.assets ?? [])].includes(value),
	);
	check(`filter option "${value}" matches an entry`, matches, 'selecting it would show nothing');
}

// ── 7. The two collections stay separate where it matters ─────────────────
// The homepage hero is the newest *issue*. A study is newer than several of
// them and must never take that slot — that is the whole reason studies live in
// their own collection rather than behind a `kind` field. Nothing else on the
// page would look wrong if this broke.
const newestIssue = issues[0];
check(
	'the hero is an issue, not a study',
	home.includes(`/issues/${newestIssue.slug}`),
	`hero should be ${newestIssue.slug}`,
);
for (const study of studies) {
	const heroSection = home.slice(0, home.indexOf('From the archive'));
	check(
		`${study.slug} is not the hero`,
		!heroSection.includes(`/studies/${study.slug}`),
		'a study has taken over "this week"',
	);
}

// And the reverse: studies must not be numbered into the weekly sequence.
check(
	'issue numbering ignores studies',
	numbers.length === issues.length && Math.max(...numbers) === issues.length,
	`highest number ${Math.max(...numbers)} across ${issues.length} issues`,
);

// ── Report ────────────────────────────────────────────────────────────────
if (failures.length > 0) {
	console.error(`\n${failures.length} of ${checks} content checks failed:\n`);
	for (const failure of failures) console.error(`  ✗ ${failure}`);
	console.error('');
	process.exit(1);
}

console.log(
	`${checks} content checks passed across ${issues.length} issues and ${studies.length} studies ` +
		`(numbering, charts, market panel, prev/next, facets, collection separation).`,
);
