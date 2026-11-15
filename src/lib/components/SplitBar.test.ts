// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { chartColour } from '$lib/utils/chart';
import SplitBar from './SplitBar.svelte';

const parts = [
	{ label: 'Vinyl', value: 50 },
	{ label: 'CD', value: 30 },
	{ label: 'Cassette', value: 20 }
];

const segments = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-segment]')];

describe('SplitBar', () => {
	it('draws a segment per part, sized by share', () => {
		const { container } = render(SplitBar, { props: { parts, label: 'By format' } });
		expect(segments(container).map((s) => s.style.flexGrow)).toEqual(['50', '30', '20']);
	});

	it('names itself with whole percents', () => {
		render(SplitBar, { props: { parts, label: 'By format' } });
		expect(screen.getByRole('img')).toHaveAccessibleName('By format: Vinyl 50%, CD 30%, Cassette 20%');
	});

	it('lists every part in the legend', () => {
		render(SplitBar, { props: { parts, label: 'By format' } });
		expect(screen.getAllByRole('listitem').map((li) => li.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
			'Vinyl 50%',
			'CD 30%',
			'Cassette 20%'
		]);
	});

	it('leaves the legend out when asked', () => {
		render(SplitBar, { props: { parts, label: 'By format', legend: false } });
		expect(screen.queryAllByRole('listitem')).toHaveLength(0);
	});

	it('gives a part called Other the Other colour', () => {
		const { container } = render(SplitBar, {
			props: { parts: [{ label: 'Vinyl', value: 5 }, { label: 'Other', value: 2 }], label: 'x' }
		});
		expect(segments(container)[1].style.background).toBe('var(--chart-other)');
	});

	it('drops zero parts but keeps their colour slot', () => {
		const { container } = render(SplitBar, {
			props: {
				parts: [{ label: 'A', value: 5 }, { label: 'B', value: 0 }, { label: 'C', value: 3 }],
				label: 'x'
			}
		});
		const segs = segments(container);
		expect(segs).toHaveLength(2);
		expect(segs[1].style.background).toBe(chartColour(2));
		expect(screen.getByRole('img')).toHaveAccessibleName('x: A 63%, C 38%');
		expect(screen.queryByText('B')).toBeNull();
	});

	it('renders nothing without parts', () => {
		const { container } = render(SplitBar, { props: { parts: [], label: 'x' } });
		expect(container.querySelector('[role="img"]')).toBeNull();
	});
});
