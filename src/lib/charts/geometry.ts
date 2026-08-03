import type { Point, ValueKind, XLabelStyle } from './types';

/**
 * Geometry and formatting shared by the three renderers.
 *
 * Every chart is drawn into the same 720-unit-wide viewBox with the same
 * gutters, so a reader moving between issues is reading the same instrument at
 * a different scale rather than a new drawing each week.
 */

export const W = 720;
export const PAD_L = 14;
export const PAD_R = 14;
export const X0 = PAD_L;
export const X1 = W - PAD_R;

/** The SVG is assembled as a string, so anything from content must be escaped. */
export function esc(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const FORMATTERS: Record<ValueKind, (v: number) => string> = {
	pct2: (v) => `${v.toFixed(2)}%`,
	pct1: (v) => `${v.toFixed(1)}%`,
	pct0: (v) => `${v.toFixed(0)}%`,
	index: (v) => v.toFixed(0),
	bp: (v) => `${v.toFixed(0)}bp`,
};

export function formatterFor(kind: ValueKind): (v: number) => string {
	return FORMATTERS[kind];
}

const X_LABELS: Record<XLabelStyle, (x: number) => string> = {
	weeks: (x) => `week ${x}`,
	months: (x) => `month ${x}`,
	quarters: (x) => `Q${x}`,
	/** A shock is measured in weeks at first and in months by the end of it. */
	'weeks-then-months': (x) => (x < 9 ? `week ${x}` : `month ${Math.round(x / 4.33)}`),
};

export function xLabeller(style: XLabelStyle): (x: number) => string {
	return X_LABELS[style];
}

/** Linear read of a series between its samples. */
export function interp(points: readonly Point[], x: number): number {
	for (let i = 0; i < points.length; i++) {
		const [a, b] = points[i];
		if (a === x) return b;
		if (a > x) {
			const [a0, b0] = points[i - 1];
			return b0 + ((x - a0) / (a - a0)) * (b - b0);
		}
	}
	return points[points.length - 1][1];
}

/** x where two series swap order, or null. Linear between samples. */
export function crossingPoint(
	a: readonly Point[],
	b: readonly Point[],
	xs: readonly number[],
): number | null {
	let prevD: number | null = null;
	let prevX = 0;
	for (const x of xs) {
		const d = interp(a, x) - interp(b, x);
		if (d === 0) return x;
		if (prevD !== null && d < 0 !== prevD < 0) {
			return prevX + (prevD / (prevD - d)) * (x - prevX);
		}
		prevD = d;
		prevX = x;
	}
	return null;
}

/** Every distinct x across one or more series, ascending. */
export function xStops(...series: readonly (readonly Point[])[]): number[] {
	const seen = new Set<number>();
	for (const s of series) for (const [x] of s) seen.add(x);
	return [...seen].sort((a, b) => a - b);
}

export type Pixel = readonly [number, number];

const n = (v: number) => v.toFixed(1);

/** Open polyline through the given pixels. */
export function polyline(pixels: readonly Pixel[]): string {
	return `M ${pixels.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ')}`;
}

/** The same polyline closed down to a baseline, for the filled area. */
export function areaPath(pixels: readonly Pixel[], baseY: number): string {
	const [firstX] = pixels[0];
	const [lastX] = pixels[pixels.length - 1];
	return `M ${n(firstX)} ${n(baseY)} L ${pixels
		.map(([x, y]) => `${n(x)} ${n(y)}`)
		.join(' L ')} L ${n(lastX)} ${n(baseY)} Z`;
}

/** A band between two polylines: out along one, back along the other. */
export function bandPath(upper: readonly Pixel[], lower: readonly Pixel[]): string {
	const out = upper.map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ');
	const back = [...lower].reverse().map(([x, y]) => `${n(x)} ${n(y)}`).join(' L ');
	return `M ${out} L ${back} Z`;
}

/**
 * The x axis with its ticks.
 *
 * Ticks at either extreme are anchored inward so a label never overhangs the
 * plot — the one place where a hairline of chrome would otherwise clip.
 */
export function frameAxis(
	xOf: (v: number) => number,
	ticks: readonly (readonly [number, string])[],
	axisY: number,
): string {
	let out = `<line class="ic-axis" x1="${X0}" y1="${axisY}" x2="${X1}" y2="${axisY}"/>`;
	for (const [value, label] of ticks) {
		const tx = xOf(value);
		const anchor = tx <= X0 + 1 ? 'start' : tx >= X1 - 1 ? 'end' : 'middle';
		out +=
			`<line class="ic-tick" x1="${n(tx)}" y1="${axisY}" x2="${n(tx)}" y2="${axisY + 5}"/>` +
			`<text class="ic-tick-label" x="${n(tx)}" y="${axisY + 18}" text-anchor="${anchor}">${esc(label)}</text>`;
	}
	return out;
}

/**
 * A peak: ringed dot, value, and when it happened.
 *
 * The label flips to the left of the dot near the right edge. It is one `<text>`
 * with two `<tspan>`s rather than two elements, so the browser flows the value
 * and the date instead of me estimating character widths — which is exactly how
 * the first version of this collided with the panel title.
 */
export function peakMark(
	x: number,
	y: number,
	value: string,
	when: string,
	extraClass = 'ic-peak',
): string {
	const anchor = x > X1 - 150 ? 'end' : 'start';
	return (
		`<circle class="ic-peak-ring" cx="${n(x)}" cy="${n(y)}" r="6"/>` +
		`<circle class="${extraClass}" cx="${n(x)}" cy="${n(y)}" r="4"/>` +
		`<text class="ic-peak-label" x="${n(x)}" y="${n(y - 13)}" text-anchor="${anchor}">` +
		`<tspan class="ic-peak-value">${esc(value)}</tspan>` +
		`<tspan class="ic-peak-when" dx="7">${esc(when)}</tspan></text>`
	);
}

/** Heading line: the series name, then its unit set faint beside it. */
export function headingText(x: number, y: number, title: string, unit: string): string {
	return (
		`<text class="ic-heading" x="${x}" y="${y}"><tspan class="ic-title">${esc(title)}</tspan>` +
		`<tspan class="ic-unit" dx="10">${esc(unit)}</tspan></text>`
	);
}

/** The crosshair the hover layer moves. Hidden until a pointer or focus arrives. */
export function hoverLayer(top: number, bottom: number): string {
	return (
		`<g class="ic-hover" data-hover hidden><line class="ic-crosshair" x1="0" y1="${top}" ` +
		`x2="0" y2="${bottom}"/></g>`
	);
}

export function svgOpen(id: string, height: number, title: string, desc: string): string {
	return (
		`<svg class="ic-svg" viewBox="0 0 ${W} ${height}" role="img" ` +
		`aria-labelledby="t-${id} d-${id}" focusable="false">` +
		`<title id="t-${id}">${esc(title)}</title>` +
		`<desc id="d-${id}">${esc(desc)}</desc>`
	);
}

export { n as fixed };
