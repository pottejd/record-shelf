// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import CollectingCalendar from './CollectingCalendar.svelte';

const addedOn = (y: number, m: number, d: number) =>
	({ date_added: new Date(y, m, d, 12).toISOString(), basic_information: {} }) as any;

describe('CollectingCalendar', () => {
	afterEach(() => vi.useRealTimers());

	it('lists the total for each month shown as text', () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date(2026, 10, 14, 18));
		render(CollectingCalendar, {
			props: { items: [addedOn(2026, 10, 2), addedOn(2026, 10, 9), addedOn(2026, 9, 20)] }
		});
		const list = screen.getByRole('list', { name: 'Records added each month' });
		expect(within(list).getByText('November 2026: 2 records')).toBeInTheDocument();
		expect(within(list).getByText('October 2026: 1 record')).toBeInTheDocument();
		expect(within(list).getByText('March 2026: 0 records')).toBeInTheDocument();
	});
});
