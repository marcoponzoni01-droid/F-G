/**
 * Site identity and the one switch that turns the newsletter on.
 */

export type NewsletterConfig =
	| { provider: 'none' }
	| { provider: 'buttondown'; handle: string }
	| { provider: 'beehiiv'; embedUrl: string };

/**
 * ─── The newsletter switch ────────────────────────────────────────────────
 *
 * Today the signup form renders complete but tells readers subscriptions open
 * shortly. When you have picked a platform and created the account, replace the
 * line below with one of the commented alternatives. Nothing else changes: no
 * component edits, no layout shift, no rebuild of the archive.
 *
 *   Buttondown → your handle is the last path segment of your public page,
 *                e.g. https://buttondown.com/thedossier  →  handle: 'thedossier'
 *   Beehiiv    → Dashboard → Grow → Subscribe Forms → Embed, copy the iframe src.
 *
 * Neither option puts a subscriber address in this repository or an API key in
 * this file — the platform owns the list, the confirmation email and the
 * unsubscribe link, which is the whole reason for using one.
 */
export const newsletter: NewsletterConfig = { provider: 'none' };
// export const newsletter: NewsletterConfig = { provider: 'buttondown', handle: 'thedossier' };
// export const newsletter: NewsletterConfig = { provider: 'beehiiv', embedUrl: 'https://embeds.beehiiv.com/xxxxxxxx' };

export const site = {
	name: 'The Dossier',
	tagline: 'The financial anatomy of geopolitical events.',
	description:
		'A weekly read on how geopolitical events move capital — and a searchable archive of what happened, what it cost, and what the market got wrong.',
	/** Shown on the subscribe page and in the signup form's fine print. */
	cadence: 'Every Sunday',
	/**
	 * When true the archive lists every issue, with the newest badged "Current
	 * issue" — so a reader searching for this week's piece still finds it. Set
	 * false to restrict the archive strictly to past issues.
	 */
	archiveIncludesCurrent: true,
	/** Used in the RSS feed and the copyright line. */
	author: 'The Dossier',
	startYear: 2026,
} as const;
