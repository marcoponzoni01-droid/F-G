/**
 * Base-aware URL helpers.
 *
 * Every internal link goes through these so the site can be served from a
 * subpath (e.g. https://user.github.io/F-G/) without touching a single
 * component. `BASE_URL` comes from `base` in astro.config.mjs, which is itself
 * read from the BASE_PATH environment variable.
 */

const BASE = import.meta.env.BASE_URL;

/** Join a root-relative path onto the configured base path. */
export function href(path = '/'): string {
	const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
	const rest = path.startsWith('/') ? path : `/${path}`;
	return `${base}${rest}` || '/';
}

/** Canonical path for a single issue. */
export function issueHref(id: string): string {
	return href(`/issues/${id}`);
}

/** Canonical path for a single study. */
export function studyHref(id: string): string {
	return href(`/studies/${id}`);
}

/** Absolute URL, for canonical tags, Open Graph and the RSS feed. */
export function absoluteUrl(path: string, origin: URL | string): string {
	return new URL(href(path), origin).toString();
}
