#!/usr/bin/env node
/**
 * Internal link checker for the built site.
 *
 * Walks dist/, pulls every internal href/src out of the HTML, and asserts the
 * target actually exists on disk. Catches the two mistakes that are easy to
 * make and invisible until a reader hits them: a renamed issue slug that other
 * pages still point at, and a link written without the base-path helper (which
 * breaks only when the site is served from a subpath).
 *
 * No network access — external links are listed, not fetched.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const BASE = (process.env.BASE_PATH ?? '/').replace(/\/+$/, '');

async function htmlFiles(dir) {
	const found = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) found.push(...(await htmlFiles(full)));
		else if (entry.name.endsWith('.html')) found.push(full);
	}
	return found;
}

/** Does this site-absolute path resolve to a real file in dist? */
function resolves(urlPath) {
	let rel = urlPath;

	// Strip the configured base path; a link that lacks it is a bug when the
	// site is served from a subpath, so report it rather than silently allowing.
	if (BASE) {
		if (!rel.startsWith(`${BASE}/`) && rel !== BASE) return false;
		rel = rel.slice(BASE.length) || '/';
	}

	const clean = decodeURIComponent(rel).replace(/^\/+/, '');
	const candidates = clean === '' ? ['index.html'] : [clean, `${clean}.html`, `${clean}/index.html`];

	return candidates.some((candidate) => {
		const target = path.join(DIST, candidate);
		return existsSync(target) && !target.includes('..');
	});
}

if (!existsSync(DIST)) {
	console.error('dist/ not found — run `npm run build` first.');
	process.exit(1);
}

const files = await htmlFiles(DIST);
const broken = [];
let internal = 0;
const external = new Set();

for (const file of files) {
	const html = await readFile(file, 'utf8');
	const from = path.relative(DIST, file);

	for (const match of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
		const raw = match[1].trim();

		if (!raw || raw.startsWith('#') || /^(?:data|mailto|tel|javascript):/i.test(raw)) continue;
		if (/^(?:https?:)?\/\//i.test(raw)) {
			external.add(raw.split('#')[0]);
			continue;
		}
		if (!raw.startsWith('/')) continue; // every internal link should be root-relative

		const urlPath = raw.split(/[?#]/)[0];
		internal += 1;
		if (!resolves(urlPath)) broken.push({ from, link: raw });
	}
}

console.log(
	`Checked ${internal} internal links across ${files.length} pages ` +
		`(${external.size} external links skipped)${BASE ? ` · base "${BASE}"` : ''}`,
);

if (broken.length > 0) {
	console.error(`\n${broken.length} broken internal link(s):`);
	for (const { from, link } of broken) console.error(`  ${from}  →  ${link}`);
	process.exit(1);
}

console.log('No broken internal links.');
