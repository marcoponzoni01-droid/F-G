import { z } from 'astro/zod';

/**
 * The shape of a chart, described in an issue's frontmatter.
 *
 * Three named types, deliberately — a fourth should have to earn its place.
 * Each is validated as a discriminated union member, so `type: divergence`
 * requires exactly two series and `type: transmission-lag` requires panels.
 * A malformed chart fails `astro check` rather than rendering blank.
 *
 *   transmission-lag  small multiples on a shared time axis, for sequence
 *   divergence        two series in one unit on one axis, for a spread
 *   event-track       one series against a calendar, for timing
 */

/** [x, y]. x is in the chart's own time unit; y is in the panel's unit. */
export const point = z.tuple([z.number(), z.number()]);
export type Point = z.infer<typeof point>;

/** [x, label] — an axis tick or, on an event-track, a dated marker. */
export const labelledX = z.tuple([z.number(), z.string()]);

/**
 * How a value is written out, in the SVG and in the numbers table alike.
 *
 * `num2` and `num1` are for a quantity whose unit is stated in the panel
 * heading rather than glued to every number — a price per barrel, an exchange
 * rate. The unit belongs in one place, not repeated fourteen times down a
 * column.
 */
export const valueKind = z.enum(['pct2', 'pct1', 'pct0', 'index', 'bp', 'num2', 'num1']);
export type ValueKind = z.infer<typeof valueKind>;

/**
 * How an x value is named in the tooltip and the table.
 *
 * A named style rather than a format string: these are the four calendars the
 * issues actually use, and `weeks-then-months` exists because a shock is
 * measured in weeks at first and in months by the end.
 */
export const xLabelStyle = z.enum(['weeks', 'weeks-then-months', 'months', 'quarters']);
export type XLabelStyle = z.infer<typeof xLabelStyle>;

/** Caption kept as data, not markup, so frontmatter never carries HTML. */
const caption = z.object({
	/** The claim, set in ink and bold. */
	lead: z.string().min(1),
	/** The evidence for it. */
	text: z.string().min(1),
});

const common = {
	/** Short slug, unique within the issue. Namespaces the SVG's title/desc ids. */
	id: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and hyphens only'),
	/**
	 * Where the numbers come from, shown under the chart and in the table caption.
	 *
	 * Omit it and the chart is labelled illustrative — which is the safe default,
	 * because an unsourced chart of a real event is worse than no chart. Set it on
	 * anything drawn from published data and name the series, not just the
	 * institution, so a reader can go and check.
	 */
	provenance: z.string().min(1).optional(),
	/** Highest x on the axis. Fixes the horizontal scale for every series. */
	span: z.number().positive(),
	/** The sentence the chart makes. Becomes the SVG's accessible name. */
	title: z.string().min(1),
	/** What a reader who cannot see it would need described. */
	desc: z.string().min(1),
	ticks: z.array(labelledX).min(2),
	xLabel: xLabelStyle,
	/**
	 * Explicit names for x positions, overriding `xLabel` where they match.
	 *
	 * `xLabel`'s four styles cover a chart whose clock starts at the event —
	 * "week 4", "Q5". A chart of a real episode has a real calendar, and a table
	 * row reading "month 14" instead of "Dec 1974" makes the reader do arithmetic
	 * the chart should have done. Positions left out here fall back to `xLabel`.
	 */
	xLabels: z.array(labelledX).optional(),
	caption,
};

/** Shared by the two single-plot types. */
const plot = {
	heading: z.string().min(1),
	unit: z.string().min(1),
	kind: valueKind,
	ymin: z.number(),
	ymax: z.number(),
	/** Where the filled area and the base rule sit. Usually `ymin`. */
	baseline: z.number(),
	/** Column head for x in the numbers table, e.g. "Quarter". */
	xHead: z.string().min(1),
};

const transmissionLag = z.object({
	type: z.literal('transmission-lag'),
	...common,
	/** Spans the peaks, naming the total lag the chart is about. */
	bracketLabel: z.string().min(1),
	panels: z
		.array(
			z.object({
				key: z.string().min(1),
				title: z.string().min(1),
				unit: z.string().min(1),
				kind: valueKind,
				baseline: z.number(),
				ymin: z.number().default(0),
				ymax: z.number(),
				peak: point,
				peakLabel: z.string().min(1),
				points: z.array(point).min(2),
			}),
		)
		.min(2),
});

const divergence = z.object({
	type: z.literal('divergence'),
	...common,
	...plot,
	/**
	 * True when the two series swap order. The gap band then means the opposite
	 * of what it meant before, so the renderer clips it at the crossing and marks
	 * the point instead of shading a region the caption does not describe.
	 */
	crossing: z.boolean().default(false),
	/** x at which to measure the gap, when the series never cross. */
	gapAt: z.number(),
	gapLabel: z.string().min(1),
	series: z
		.array(
			z.object({
				name: z.string().min(1),
				points: z.array(point).min(2),
			}),
		)
		/** First is the reference, in neutral ink; second is the subject, in accent. */
		.length(2),
});

const eventTrack = z.object({
	type: z.literal('event-track'),
	...common,
	...plot,
	peak: point,
	peakLabel: z.string().min(1),
	/** Dates that moved the series. Drawn on the axis, labelled beneath it. */
	markers: z.array(labelledX).min(2),
	/** Optional horizontal comparison, e.g. a five-year average. [value, label] */
	ref: z.tuple([z.number(), z.string()]).optional(),
	points: z.array(point).min(2),
});

export const chartSchema = z.discriminatedUnion('type', [transmissionLag, divergence, eventTrack]);

export type ChartSpec = z.infer<typeof chartSchema>;
export type TransmissionLagSpec = z.infer<typeof transmissionLag>;
export type DivergenceSpec = z.infer<typeof divergence>;
export type EventTrackSpec = z.infer<typeof eventTrack>;

/** What the hover layer needs, serialised into the figure as JSON. */
export interface HoverData {
	x0: number;
	x1: number;
	span: number;
	w: number;
	labels: Record<string, string>;
	tracks: { name: string; kind: ValueKind; points: Point[] }[];
}

export interface RenderedChart {
	/** The complete `<svg>` element. */
	svg: string;
	/** Column heads for the numbers table; a pair is [name, unit]. */
	head: (string | [string, string])[];
	/** One row per x stop, first cell being the x label. */
	rows: string[][];
	hover: HoverData;
}
