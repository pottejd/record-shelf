// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/svelte';
import CollectingCalendar from './CollectingCalendar.svelte';

const addedOn = (y: number, m: number, d: number) =>
	({ date_added: new Date(y, m, d, 12).toISOString(), basic_information: {} }) as any;

describe('CollectingCalendar', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		// Saturday 14 November 2026.
		vi.setSystemTime(new Date(2026, 10, 14, 18));
	});
	afterEach(() => vi.useRealTimers());

	it('lists the total for each month shown as text', () => {
		render(CollectingCalendar, {
			props: { items: [addedOn(2026, 10, 2), addedOn(2026, 10, 9), addedOn(2026, 9, 20)] }
		});
		const list = screen.getByRole('list', { name: 'Records added each month in the past year' });
		expect(within(list).getByText('November 2026: 2 records')).toBeInTheDocument();
		expect(within(list).getByText('October 2026: 1 record')).toBeInTheDocument();
		expect(within(list).getByText('March 2026: 0 records')).toBeInTheDocument();
	});

	it('says how many records arrived in the past year', () => {
		render(CollectingCalendar, { props: { items: [addedOn(2026, 10, 2), addedOn(2026, 9, 20), addedOn(2024, 1, 1)] } });
		expect(screen.getByText('2 records added in the past year')).toBeInTheDocument();
	});

	it('names every day; only a day with records has a label to show and a shade', () => {
		render(CollectingCalendar, { props: { items: [addedOn(2026, 10, 13), addedOn(2026, 10, 13)] } });
		const grid = screen.getByRole('grid', { name: 'Records added each day in the past year' });
		const day = within(grid).getByRole('gridcell', { name: 'Fri, Nov 13, 2026: 2 records' });
		expect(day.querySelector('.day-tip')).toHaveTextContent('Fri, Nov 13, 2026: 2 records');
		expect(day).toHaveClass('step-5');
		const empty = within(grid).getByRole('gridcell', { name: 'Thu, Nov 12, 2026: no records' });
		expect(empty.querySelector('.day-tip')).toBeNull();
		expect(empty).toHaveClass('step-0');
		// Seven rows, Sunday first; Saturday's row ends on today.
		const rows = within(grid).getAllByRole('row');
		expect(rows).toHaveLength(7);
		const saturdays = within(rows[6]).getAllByRole('gridcell');
		expect(saturdays[saturdays.length - 1]).toHaveAccessibleName('Sat, Nov 14, 2026: no records');
	});

	it('is one tab stop, on the latest day with records', () => {
		render(CollectingCalendar, { props: { items: [addedOn(2026, 10, 2), addedOn(2026, 10, 9)] } });
		const grid = screen.getByRole('grid');
		const stops = grid.querySelectorAll('[tabindex="0"]');
		expect(stops).toHaveLength(1);
		expect(stops[0]).toHaveAccessibleName('Mon, Nov 9, 2026: 1 record');
	});

	it('is one tab stop on today when the year has no records', () => {
		render(CollectingCalendar, { props: { items: [] } });
		const stops = screen.getByRole('grid').querySelectorAll('[tabindex="0"]');
		expect(stops).toHaveLength(1);
		expect(stops[0]).toHaveAccessibleName('Sat, Nov 14, 2026: no records');
	});

	it('moves a day with up and down, a week with left and right, and holds at the edges', async () => {
		render(CollectingCalendar, { props: { items: [addedOn(2026, 10, 9)] } });
		const grid = screen.getByRole('grid');
		const focused = () => document.activeElement?.getAttribute('aria-label');
		const press = async (key: string, init: KeyboardEventInit = {}) => {
			await fireEvent.keyDown(document.activeElement ?? grid, { key, ...init });
		};
		(grid.querySelector('[tabindex="0"]') as HTMLElement).focus();
		expect(focused()).toBe('Mon, Nov 9, 2026: 1 record');

		await press('ArrowUp');
		expect(focused()).toBe('Sun, Nov 8, 2026: no records');
		await press('ArrowUp'); // Sunday is the top row
		expect(focused()).toBe('Sun, Nov 8, 2026: no records');
		await press('ArrowDown');
		await press('ArrowRight'); // no week after this one
		expect(focused()).toBe('Mon, Nov 9, 2026: 1 record');
		await press('ArrowLeft');
		expect(focused()).toBe('Mon, Nov 2, 2026: no records');
		await press('ArrowRight');
		expect(focused()).toBe('Mon, Nov 9, 2026: 1 record');
		await press('ArrowDown');
		await press('ArrowDown');
		await press('ArrowDown');
		await press('ArrowDown');
		await press('ArrowDown');
		expect(focused()).toBe('Sat, Nov 14, 2026: no records');
		await press('ArrowDown'); // today is the last day
		expect(focused()).toBe('Sat, Nov 14, 2026: no records');
		await press('Home');
		expect(focused()).toBe('Sat, Nov 15, 2025: no records'); // the first week starts on Sunday 9 November 2025
		await press('End');
		expect(focused()).toBe('Sat, Nov 14, 2026: no records');

		const stops = grid.querySelectorAll('[tabindex="0"]');
		expect(stops).toHaveLength(1);
		expect(stops[0]).toBe(document.activeElement);
	});
});
