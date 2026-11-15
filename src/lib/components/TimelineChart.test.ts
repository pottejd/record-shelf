// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import TimelineChart from './TimelineChart.svelte';

describe('TimelineChart', () => {
	it('lists every month and its count as text', () => {
		render(TimelineChart, {
			props: { data: [{ date: '2026-01', count: 3 }, { date: '2026-02', count: 5 }, { date: '2026-03', count: 0 }] }
		});
		const list = screen.getByRole('list', { name: 'Records added each month' });
		expect(within(list).getByText('2026-01: 3 added')).toBeInTheDocument();
		expect(within(list).getByText('2026-02: 5 added')).toBeInTheDocument();
		expect(within(list).getByText('2026-03: 0 added')).toBeInTheDocument();
	});
});
