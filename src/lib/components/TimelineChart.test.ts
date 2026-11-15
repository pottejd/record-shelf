// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import TimelineChart from './TimelineChart.svelte';

const data = [{ date: '2026-01', count: 3 }, { date: '2026-02', count: 5 }, { date: '2026-03', count: 1 }];

describe('TimelineChart', () => {
	it('lists every month and its count as text', () => {
		render(TimelineChart, { props: { data: [...data, { date: '2026-04', count: 0 }] } });
		const list = screen.getByRole('list', { name: 'Collection growth by month' });
		expect(within(list).getByText('January 2026: 3 records')).toBeInTheDocument();
		expect(within(list).getByText('February 2026: 5 records')).toBeInTheDocument();
		expect(within(list).getByText('March 2026: 1 record')).toBeInTheDocument();
		expect(within(list).getByText('April 2026: 0 records')).toBeInTheDocument();
	});

	it('writes the last month\'s count beside the end dot, and names the first and last months', () => {
		const { container } = render(TimelineChart, { props: { data } });
		expect(container.querySelector('.end-dot')).not.toBeNull();
		expect(container.querySelector('.end-value')).toHaveTextContent(/^1$/);
		expect(screen.getByText('Jan 2026')).toBeInTheDocument();
		expect(screen.getByText('Mar 2026')).toBeInTheDocument();
		expect(container.querySelectorAll('circle')).toHaveLength(0);
	});
});
