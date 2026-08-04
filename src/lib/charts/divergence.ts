import {
	bandPath,
	crossingPoint,
	esc,
	fixed as n,
	formatterFor,
	frameAxis,
	headingText,
	hoverLayer,
	interp,
	polyline,
	svgOpen,
	W,
	X0,
	X1,
	xLabeller,
	xStops,
	type Pixel,
} from './geometry';
import type { DivergenceSpec, RenderedChart } from './types';

/**
 * Two series in one unit on one axis. The gap between them is the subject.
 *
 * The second series is neutral ink, not a second hue: this is emphasis, not a
 * categorical palette, so the one-accent rule survives a chart with two lines.
 * Identity is carried three ways — a legend, the line weight, and a direct
 * end-label on each series — because colour alone is never enough.
 */

const PLOT_H = 210;
const TITLE_H = 46;
const AXIS_H = 26;

/**
 * Rough advance width of the legend's mono label, in viewBox units.
 *
 * An estimate is safe here and nowhere else in these charts: it only slides the
 * second key rightward along an otherwise empty 692-unit line, and the longest
 * pair of series names in use occupies well under half of it. Where a width
 * estimate decided whether a label collided — the peak labels — it is gone,
 * replaced by tspan flow.
 */
const LEGEND_CHAR = 6.4;

export function renderDivergence(spec: DivergenceSpec): RenderedChart {
	const { span, ymin, ymax } = spec;
	const top = TITLE_H;
	const axisY = top + PLOT_H + 8;
	const height = axisY + AXIS_H + 26;

	const xOf = (v: number) => X0 + (v / span) * (X1 - X0);
	const yOf = (v: number) => top + PLOT_H - ((v - ymin) / (ymax - ymin)) * PLOT_H;
	const at = (points: readonly [number, number][], x: number): Pixel => [
		xOf(x),
		yOf(interp(points, x)),
	];

	const format = formatterFor(spec.kind);
	const [reference, subject] = spec.series;
	const pixelsRef: Pixel[] = reference.points.map(([x, v]) => [xOf(x), yOf(v)]);
	const pixelsSub: Pixel[] = subject.points.map(([x, v]) => [xOf(x), yOf(v)]);

	// Where the series cross, the band past that point means the opposite of what
	// it meant before — so clip it at the crossing rather than shading a region
	// the caption does not describe.
	const stops = xStops(reference.points, subject.points);
	const cross = spec.crossing ? crossingPoint(reference.points, subject.points, stops) : null;
	let bandRef = pixelsRef;
	let bandSub = pixelsSub;
	if (cross !== null) {
		const before = stops.filter((x) => x < cross);
		bandRef = [...before.map((x) => at(reference.points, x)), at(reference.points, cross)];
		bandSub = [...before.map((x) => at(subject.points, x)), at(subject.points, cross)];
	}

	const keyX = X0 + 24 + reference.name.length * LEGEND_CHAR;
	const legend =
		`<g class="ic-legend">` +
		`<line class="ic-key-ref" x1="${X0}" y1="${top - 16}" x2="${X0 + 16}" y2="${top - 16}"/>` +
		`<text class="ic-legend-label" x="${X0 + 22}" y="${top - 12}">${esc(reference.name)}</text>` +
		`<line class="ic-key-main" x1="${keyX.toFixed(0)}" y1="${top - 16}" ` +
		`x2="${(keyX + 16).toFixed(0)}" y2="${top - 16}"/>` +
		`<text class="ic-legend-label" x="${(keyX + 22).toFixed(0)}" y="${top - 12}">${esc(subject.name)}</text>` +
		`</g>`;

	// Direct end-labels: the dependable identity channel beside the legend. They
	// sit on opposite sides of their dots so two converging series cannot stack.
	const [refEndX, refEndY] = pixelsRef[pixelsRef.length - 1];
	const [subEndX, subEndY] = pixelsSub[pixelsSub.length - 1];
	const ends =
		`<circle class="ic-end-ring" cx="${n(refEndX)}" cy="${n(refEndY)}" r="6"/>` +
		`<circle class="ic-end-ref" cx="${n(refEndX)}" cy="${n(refEndY)}" r="4"/>` +
		`<text class="ic-end-label" x="${n(refEndX - 10)}" y="${n(refEndY - 12)}" text-anchor="end">` +
		`${esc(format(reference.points[reference.points.length - 1][1]))}</text>` +
		`<circle class="ic-end-ring" cx="${n(subEndX)}" cy="${n(subEndY)}" r="6"/>` +
		`<circle class="ic-peak" cx="${n(subEndX)}" cy="${n(subEndY)}" r="4"/>` +
		`<text class="ic-end-label ic-end-main" x="${n(subEndX - 10)}" y="${n(subEndY + 20)}" text-anchor="end">` +
		`${esc(format(subject.points[subject.points.length - 1][1]))}</text>`;

	// One annotated measurement: the crossing if there is one, else the gap at
	// its widest.
	let annotation: string;
	if (cross !== null) {
		const cy = yOf(interp(reference.points, cross));
		annotation =
			`<circle class="ic-cross-ring" cx="${n(xOf(cross))}" cy="${n(cy)}" r="6"/>` +
			`<circle class="ic-cross" cx="${n(xOf(cross))}" cy="${n(cy)}" r="3.5"/>` +
			`<text class="ic-gap-label" x="${n(xOf(cross) - 10)}" y="${n(cy - 12)}" text-anchor="end">` +
			`${esc(spec.gapLabel)}</text>`;
	} else {
		const gx = spec.gapAt;
		const ga = yOf(interp(reference.points, gx));
		const gb = yOf(interp(subject.points, gx));
		annotation =
			`<line class="ic-gap-rule" x1="${n(xOf(gx))}" y1="${n(ga)}" x2="${n(xOf(gx))}" y2="${n(gb)}"/>` +
			`<text class="ic-gap-label" x="${n(xOf(gx) + 8)}" y="${n((ga + gb) / 2 + 4)}">${esc(spec.gapLabel)}</text>`;
	}

	const baseY = yOf(spec.baseline);
	const svg =
		svgOpen(spec.id, height, spec.title, spec.desc) +
		headingText(X0, 16, spec.heading, spec.unit) +
		legend +
		`<line class="ic-base" x1="${X0}" y1="${n(baseY)}" x2="${X1}" y2="${n(baseY)}"/>` +
		`<path class="ic-gap" d="${bandPath(bandRef, bandSub)}"/>` +
		`<path class="ic-line-ref" d="${polyline(pixelsRef)}"/>` +
		`<path class="ic-line" d="${polyline(pixelsSub)}"/>` +
		annotation +
		ends +
		`<g data-axis>${frameAxis(xOf, spec.ticks, axisY)}</g>` +
		hoverLayer(top - 4, top + PLOT_H) +
		`</svg>`;

	const label = xLabeller(spec.xLabel, spec.xLabels);

	return {
		svg,
		head: [spec.xHead, [reference.name, spec.unit], [subject.name, spec.unit]],
		rows: stops.map((x) => [
			label(x),
			format(interp(reference.points, x)),
			format(interp(subject.points, x)),
		]),
		hover: {
			x0: X0,
			x1: X1,
			span,
			w: W,
			labels: Object.fromEntries(stops.map((x) => [String(x), label(x)])),
			tracks: spec.series.map((s) => ({ name: s.name, kind: spec.kind, points: s.points })),
		},
	};
}
