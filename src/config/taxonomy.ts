/**
 * The single source of truth for how issues are classified.
 *
 * These lists drive three things at once: the zod schema that validates every
 * issue's frontmatter, the filter controls on /archive, and the chip labels
 * across the site. Adding a region or an asset class is a one-line change here
 * and it propagates everywhere — and a typo in an issue's frontmatter becomes a
 * build failure rather than a silently empty filter.
 */

export const REGIONS = [
	'United States',
	'Europe',
	'United Kingdom',
	'Russia & CIS',
	'China',
	'Japan & Korea',
	'South & Southeast Asia',
	'Middle East',
	'Africa',
	'Latin America',
	'Global',
] as const;

export type Region = (typeof REGIONS)[number];

export const ASSETS = [
	'Equities',
	'Rates',
	'Credit',
	'Sovereign Debt',
	'FX',
	'USD',
	'EUR',
	'Gold',
	'Brent',
	'Natural Gas',
	'Commodities',
	'Freight',
	'Crypto',
] as const;

export type Asset = (typeof ASSETS)[number];

export const EVENT_TYPES = [
	{ id: 'conflict', label: 'Conflict' },
	{ id: 'sanctions', label: 'Sanctions' },
	{ id: 'elections', label: 'Elections' },
	{ id: 'trade-policy', label: 'Trade policy' },
	{ id: 'energy', label: 'Energy' },
	{ id: 'monetary', label: 'Monetary policy' },
	{ id: 'sovereign-debt', label: 'Sovereign debt' },
	{ id: 'supply-chain', label: 'Supply chain' },
] as const;

export type EventTypeId = (typeof EVENT_TYPES)[number]['id'];

export const EVENT_TYPE_IDS = EVENT_TYPES.map((t) => t.id) as unknown as readonly [
	EventTypeId,
	...EventTypeId[],
];

const EVENT_TYPE_LABELS = new Map<string, string>(EVENT_TYPES.map((t) => [t.id, t.label]));

/** Human label for an event-type id, falling back to the raw id. */
export function eventTypeLabel(id: string): string {
	return EVENT_TYPE_LABELS.get(id) ?? id;
}
