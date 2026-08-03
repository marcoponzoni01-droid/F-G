import { renderDivergence } from './divergence';
import { renderEventTrack } from './event-track';
import { renderTransmissionLag } from './transmission-lag';
import type { ChartSpec, RenderedChart } from './types';

export { chartSchema } from './types';
export type { ChartSpec, RenderedChart } from './types';

/**
 * Turn a validated chart spec into SVG, a numbers table and hover data.
 *
 * Pure: same spec in, same string out, no runtime dependency and nothing to
 * hydrate. The chart is complete in the HTML the server sends, which is why the
 * hover layer can be an enhancement rather than the only way to read a value.
 */
export function renderChart(spec: ChartSpec): RenderedChart {
	switch (spec.type) {
		case 'transmission-lag':
			return renderTransmissionLag(spec);
		case 'divergence':
			return renderDivergence(spec);
		case 'event-track':
			return renderEventTrack(spec);
	}
}
