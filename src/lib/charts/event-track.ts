import {
	areaPath,
	esc,
	fixed as n,
	formatterFor,
	frameAxis,
	headingText,
	hoverLayer,
	interp,
	peakMark,
	polyline,
	svgOpen,
	W,
	X0,
	X1,
	xLabeller,
	type Pixel,
} from './geometry';
import type { EventTrackSpec, RenderedChart } from './types';

/**
 * One series against a calendar, with the dates that moved it.
 *
 * Markers stand on the axis and are labelled beneath it rather than inside the
 * plot, so annotation never competes with the line it annotates — the same
 * discipline that moved the prototype's structure notes out of the grids they
 * described.
 */

const PLOT_H = 200;
const TITLE_H = 40;
const AXIS_H = 26;
const MARK_H = 40;

/** Vertical step between staggered rows of marker labels. */
const MARK_ROW_H = 15;

/**
 * Conservative advance width per character of the marker label, in viewBox
 * units, at its 10px mono size.
 *
 * Overstated on purpose. Getting this wrong low puts two labels on top of each
 * other — the failure this exists to prevent — while getting it wrong high only
 * moves a label to a row it did not strictly need. So it rounds up.
 */
const MARK_CHAR = 6.2;

/**
 * Assign each marker a label row so that no two labels overlap.
 *
 * Markers cluster: an event's decisive dates are often days apart on an axis
 * spanning years, and three labels centred within a few pixels of each other are
 * unreadable however carefully the rest of the chart is drawn. Rows are assigned
 * greedily left to right — the first row whose last label has already ended.
 */
function assignRows(
	markers: readonly (readonly [number, string])[],
	xOf: (v: number) => number,
): number[] {
	const rowEnds: number[] = [];
	return markers.map(([x, label]) => {
		const halfWidth = (label.length * MARK_CHAR) / 2;
		const left = xOf(x) - halfWidth;
		const right = xOf(x) + halfWidth;
		let row = rowEnds.findIndex((end) => left > end + 6);
		if (row === -1) row = rowEnds.length;
		rowEnds[row] = right;
		return row;
	});
}

export function renderEventTrack(spec: EventTrackSpec): RenderedChart {
	const { span, ymin, ymax } = spec;
	const top = TITLE_H;
	const axisY = top + PLOT_H + 8;

	const xOf = (v: number) => X0 + (v / span) * (X1 - X0);
	const yOf = (v: number) => top + PLOT_H - ((v - ymin) / (ymax - ymin)) * PLOT_H;

	// The figure grows to fit however many rows the markers need, so a cluster of
	// dates costs height rather than legibility.
	const rows = assignRows(spec.markers, xOf);
	const height = axisY + AXIS_H + MARK_H + Math.max(...rows) * MARK_ROW_H;

	const format = formatterFor(spec.kind);
	const pixels: Pixel[] = spec.points.map(([x, v]) => [xOf(x), yOf(v)]);
	const baseY = yOf(spec.baseline);

	let reference = '';
	if (spec.ref) {
		const [value, label] = spec.ref;
		// Set into open plot rather than at either edge: at the left the series
		// starts on the reference value and at the right it runs back down through
		// it, so both edges would put text on the line.
		reference =
			`<line class="ic-ref" x1="${X0}" y1="${n(yOf(value))}" x2="${X1}" y2="${n(yOf(value))}"/>` +
			`<text class="ic-ref-label" x="${n(X0 + 0.6 * (X1 - X0))}" y="${n(yOf(value) - 7)}" ` +
			`text-anchor="middle">${esc(label)}</text>`;
	}

	let markers = '';
	spec.markers.forEach(([x, label], i) => {
		const tx = xOf(x);
		const anchor = tx <= X0 + 2 ? 'start' : tx >= X1 - 2 ? 'end' : 'middle';
		const labelY = axisY + 34 + rows[i] * MARK_ROW_H;
		// A label on a lower row needs a leader back to its own marker, or the
		// reader has to guess which date it belongs to.
		const leader =
			rows[i] === 0
				? ''
				: `<line class="ic-marker-rule" x1="${n(tx)}" y1="${axisY + 4}" x2="${n(tx)}" y2="${labelY - 8}"/>`;
		markers +=
			`<line class="ic-marker-rule" x1="${n(tx)}" y1="${top - 4}" x2="${n(tx)}" y2="${axisY}"/>` +
			`<circle class="ic-marker" cx="${n(tx)}" cy="${axisY}" r="3.5"/>` +
			leader +
			`<text class="ic-marker-label" x="${n(tx)}" y="${labelY}" text-anchor="${anchor}">${esc(label)}</text>`;
	});

	const [peakX, peakV] = spec.peak;
	const svg =
		svgOpen(spec.id, height, spec.title, spec.desc) +
		headingText(X0, 18, spec.heading, spec.unit) +
		markers +
		`<line class="ic-base" x1="${X0}" y1="${n(baseY)}" x2="${X1}" y2="${n(baseY)}"/>` +
		`<path class="ic-area" d="${areaPath(pixels, baseY)}"/>` +
		`<path class="ic-line" d="${polyline(pixels)}"/>` +
		reference +
		peakMark(xOf(peakX), yOf(peakV), format(peakV), spec.peakLabel) +
		`<g data-axis>${frameAxis(xOf, spec.ticks, axisY)}</g>` +
		hoverLayer(top - 4, top + PLOT_H) +
		`</svg>`;

	const label = xLabeller(spec.xLabel, spec.xLabels);
	const stops = spec.points.map(([x]) => x);
	const markerAt = new Map(spec.markers.map(([x, text]) => [x, text]));

	return {
		svg,
		head: [spec.xHead, [spec.heading, spec.unit], 'Event'],
		rows: stops.map((x) => [label(x), format(interp(spec.points, x)), markerAt.get(x) ?? '']),
		hover: {
			x0: X0,
			x1: X1,
			span,
			w: W,
			labels: Object.fromEntries(stops.map((x) => [String(x), label(x)])),
			tracks: [{ name: spec.heading, kind: spec.kind, points: spec.points }],
		},
	};
}
