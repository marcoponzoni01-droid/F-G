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
import path from 'node:path';

const DIST = path.resolve('dist');

/** Charts each issue is expected to carry. A chart silently lost is a regression. */
const EXPECTED_CHARTS = {
	'2026-07-26-red-sea-reroutes': 'transmission-lag',
	'2026-07-19-sanctions-designation-gap': 'divergence',
	'2026-07-12-substitution-clock': 'divergence',
	'2026-07-05-election-premium': 'event-track',
	'2026-06-28-storage-is-the-constraint': 'event-track',
};

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

const home = await read('index.html');
const archive = await read(path.join('archive', 'index.html'));
const index = JSON.parse(await read('search-index.json'));

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
	index.length === issues.length,
	`${index.length} records, ${issues.length} issues`,
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
}

// ── 4. The market panel compounds week to week ────────────────────────────
// Each issue quotes a level and a week-over-week change. Consecutive issues must
// therefore agree: last week's level, moved by this week's change, is this
// week's level. Hand-written numbers drift apart silently; this catches it.
function panel(html) {
	const section = html.match(/<section aria-label="Market moves"[\s\S]*?<\/section>/);
	if (!section) return null;
	const rows = [...section[0].matchAll(/<li[^>]*data-move[^>]*>([\s\S]*?)<\/li>/g)];
	return rows.map((row) => {
		const body = row[1];
		const name = text(body.split('<span')[1] ?? '').trim();
		const level = body.match(/data-level[^>]*>([^<]+)</);
		const change = body.match(/data-change[^>]*>([^<]+)</);
		return {
			instrument: text(body.match(/<span class="text-sm">([^<]+)<\/span>/)?.[1] ?? name),
			level: level ? Number(level[1].replace(/,/g, '')) : null,
			change: change ? Number(change[1].replace('−', '-').replace('%', '')) : null,
		};
	});
}

const panels = issues.map((issue) => ({ slug: issue.slug, rows: panel(issue.html) }));
for (const { slug, rows } of panels) {
	check(`${slug} has a market panel`, rows !== null && rows.length > 0);
}

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
const eventTypes = new Set(index.map((r) => r.eventType));
check(
	'issues span more than one event type',
	eventTypes.size > 1,
	`all ${index.length} issues are ${[...eventTypes][0]}`,
);

for (const facet of ['eventType', 'regions', 'assets']) {
	const values = new Set(index.flatMap((r) => [r[facet]].flat()));
	check(`archive offers more than one ${facet}`, values.size > 1, [...values].join(', '));
}

// Every value the filter controls offer must match at least one issue, or the
// reader picks it and gets an empty page.
const options = all(archive, /<option value="([^"]+)"/g)
	.map(decode)
	.filter((v) => v && v !== 'all');
for (const value of new Set(options)) {
	const matches = index.some((r) =>
		[r.eventType, ...(r.regions ?? []), ...(r.assets ?? [])].includes(value),
	);
	check(`filter option "${value}" matches an issue`, matches, 'selecting it would show nothing');
}

// ── Report ────────────────────────────────────────────────────────────────
if (failures.length > 0) {
	console.error(`\n${failures.length} of ${checks} content checks failed:\n`);
	for (const failure of failures) console.error(`  ✗ ${failure}`);
	console.error('');
	process.exit(1);
}

console.log(
	`${checks} content checks passed across ${issues.length} issues ` +
		`(numbering, charts, market panel, prev/next, facets).`,
);
