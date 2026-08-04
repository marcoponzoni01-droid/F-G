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
	xStops,
	type Pixel,
} from './geometry';
import type { RenderedChart, TransmissionLagSpec } from './types';

/**
 * Small multiples on one shared timeline.
 *
 * Each panel keeps its own vertical scale because the series are in different
 * units — a war-risk premium in percent of hull value cannot share an axis with
 * a freight index, and forcing them onto one would be the dual-axis mistake by
 * another name. What they do share is the horizontal axis, which is the whole
 * point: the reader compares *when*, not how much.
 */

const PANEL_H = 92;
const TITLE_H = 32;
const GAP = 18;
const AXIS_H = 26;
const BRACKET_H = 44;

export function renderTransmissionLag(spec: TransmissionLagSpec): RenderedChart {
	const { panels, span } = spec;
	const xOf = (v: number) => X0 + (v / span) * (X1 - X0);

	const tops: number[] = [];
	let y = 0;
	for (const _ of panels) {
		tops.push(y + TITLE_H);
		y += TITLE_H + PANEL_H + GAP;
	}
	const axisY = y - GAP + 8;
	const height = axisY + AXIS_H + BRACKET_H;

	const yOf = (panel: TransmissionLagSpec['panels'][number], value: number, top: number) =>
		top + PANEL_H - ((value - panel.ymin) / (panel.ymax - panel.ymin)) * PANEL_H;

	let body = '';
	panels.forEach((panel, i) => {
		const top = tops[i];
		const format = formatterFor(panel.kind);
		const pixels: Pixel[] = panel.points.map(([x, v]) => [xOf(x), yOf(panel, v, top)]);
		const baseY = yOf(panel, panel.baseline, top);
		const [peakX, peakV] = panel.peak;
		const startValue = panel.points[0][1];

		body +=
			`<g data-panel="${esc(panel.key)}">` +
			headingText(X0, top - 14, panel.title, panel.unit) +
			`<line class="ic-base" x1="${X0}" y1="${n(baseY)}" x2="${X1}" y2="${n(baseY)}"/>` +
			`<path class="ic-area" d="${areaPath(pixels, baseY)}"/>` +
			`<path class="ic-line" d="${polyline(pixels)}"/>` +
			`<text class="ic-start" x="${X0 + 6}" y="${n(yOf(panel, startValue, top) - 11)}">${esc(
				format(startValue),
			)}</text>` +
			peakMark(xOf(peakX), yOf(panel, peakV, top), format(peakV), panel.peakLabel) +
			`</g>`;
	});

	// The shock is one vertical rule crossing every panel — the single moment the
	// three clocks are all measured from.
	const shockTop = tops[0] - 6;
	const shockBottom = tops[tops.length - 1] + PANEL_H;
	const shock =
		`<line class="ic-shock" x1="${n(xOf(0))}" y1="${shockTop}" x2="${n(xOf(0))}" y2="${shockBottom}"/>`;

	// The bracket spans first peak to last, naming the lag the chart is about.
	const b0 = xOf(panels[0].peak[0]);
	const b1 = xOf(panels[panels.length - 1].peak[0]);
	const by = axisY + AXIS_H + 12;
	const bracket =
		`<path class="ic-bracket" d="M ${n(b0)} ${by} L ${n(b0)} ${by + 7} L ${n(b1)} ${by + 7} L ${n(b1)} ${by}"/>` +
		`<text class="ic-bracket-label" x="${n((b0 + b1) / 2)}" y="${by + 25}" text-anchor="middle">` +
		`${esc(spec.bracketLabel)}</text>`;

	const svg =
		svgOpen(spec.id, height, spec.title, spec.desc) +
		shock +
		body +
		`<g data-axis>${frameAxis(xOf, spec.ticks, axisY)}</g>` +
		`<g data-annotation>${bracket}</g>` +
		hoverLayer(shockTop, shockBottom) +
		`</svg>`;

	const label = xLabeller(spec.xLabel, spec.xLabels);
	const stops = xStops(...panels.map((p) => p.points));

	return {
		svg,
		head: ['Time', ...panels.map((p) => [p.title, p.unit] as [string, string])],
		rows: stops.map((x) => [
			label(x),
			...panels.map((p) => formatterFor(p.kind)(interp(p.points, x))),
		]),
		hover: {
			x0: X0,
			x1: X1,
			span,
			w: W,
			labels: Object.fromEntries(stops.map((x) => [String(x), label(x)])),
			tracks: panels.map((p) => ({ name: p.title, kind: p.kind, points: p.points })),
		},
	};
}
