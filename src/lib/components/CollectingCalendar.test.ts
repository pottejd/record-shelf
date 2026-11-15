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

	it('names every day; only a day with records has a shade', () => {
		render(CollectingCalendar, { props: { items: [addedOn(2026, 10, 13), addedOn(2026, 10, 13)] } });
		const grid = screen.getByRole('grid', { name: 'Records added each day in the past year' });
		const day = within(grid).getByRole('gridcell', { name: 'Fri, Nov 13, 2026: 2 records' });
		expect(day).toHaveClass('step-5');
		const empty = within(grid).getByRole('gridcell', { name: 'Thu, Nov 12, 2026: no records' });
		expect(empty).toHaveClass('step-0');
		// Seven rows, Sunday first; Saturday's row ends on today.
		const rows = within(grid).getAllByRole('row');
		expect(rows).toHaveLength(7);
		const saturdays = within(rows[6]).getAllByRole('gridcell');
		expect(saturdays[saturdays.length - 1]).toHaveAccessibleName('Sat, Nov 14, 2026: no records');
	});

	it('shows one label, outside the scroll box: under the pointer only for a day with records', async () => {
		const { container } = render(CollectingCalendar, { props: { items: [addedOn(2026, 10, 13)] } });
		const grid = screen.getByRole('grid');
		expect(container.querySelector('.day-tip')).toBeNull();
		await fireEvent.pointerMove(within(grid).getByRole('gridcell', { name: 'Thu, Nov 12, 2026: no records' }), { clientX: 10, clientY: 10 });
		expect(container.querySelector('.day-tip')).toBeNull();
		const day = within(grid).getByRole('gridcell', { name: 'Fri, Nov 13, 2026: 1 record' });
		await fireEvent.pointerMove(day, { clientX: 20, clientY: 10 });
		const tip = container.querySelector('.day-tip');
		expect(tip).toHaveTextContent('Fri, Nov 13, 2026: 1 record');
		expect(grid.contains(tip)).toBe(false);
		await fireEvent.pointerLeave(day);
		expect(container.querySelector('.day-tip')).toBeNull();
	});

	it('takes a move under a still pointer (the box scrolling) for no move at all', async () => {
		const { container } = render(CollectingCalendar, { props: { items: [addedOn(2026, 10, 13), addedOn(2026, 10, 6)] } });
		const grid = screen.getByRole('grid');
		const fri = within(grid).getByRole('gridcell', { name: 'Fri, Nov 13, 2026: 1 record' });
		const before = within(grid).getByRole('gridcell', { name: 'Fri, Nov 6, 2026: 1 record' });
		await fireEvent.pointerMove(fri, { clientX: 20, clientY: 10 });
		await fireEvent.pointerLeave(fri);
		await fireEvent.pointerMove(before, { clientX: 20, clientY: 10 }); // same spot: the day slid under it
		expect(container.querySelector('.day-tip')).toBeNull();
		await fireEvent.pointerMove(before, { clientX: 21, clientY: 10 });
		expect(container.querySelector('.day-tip')).toHaveTextContent('Fri, Nov 6, 2026: 1 record');
	});

	it('lets the keys lead: an arrow moves the label off a day the pointer rests on', async () => {
		const { container } = render(CollectingCalendar, { props: { items: [addedOn(2026, 10, 13), addedOn(2026, 10, 12)] } });
		const grid = screen.getByRole('grid');
		const fri = within(grid).getByRole('gridcell', { name: 'Fri, Nov 13, 2026: 1 record' });
		await fireEvent.pointerMove(fri, { clientX: 20, clientY: 10 });
		fri.focus();
		await fireEvent.keyDown(fri, { key: 'ArrowUp' });
		expect(document.activeElement).toHaveAccessibleName('Thu, Nov 12, 2026: 1 record');
		expect(container.querySelector('.day-tip')?.textContent).not.toBe('Fri, Nov 13, 2026: 1 record');
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

	it('counts a record on the year\'s first day, earlier in the day than now, on its cell and in the total', () => {
		// Now is 18:00 on Saturday 14 November 2026, so the year starts on Friday 14 November 2025.
		const morning = { date_added: new Date(2025, 10, 14, 9).toISOString(), basic_information: {} } as any;
		const before = { date_added: new Date(2025, 10, 12, 9).toISOString(), basic_information: {} } as any;
		render(CollectingCalendar, { props: { items: [morning, before, addedOn(2026, 10, 2)] } });
		const grid = screen.getByRole('grid');
		expect(within(grid).getByRole('gridcell', { name: 'Fri, Nov 14, 2025: 1 record' })).toBeInTheDocument();
		expect(screen.getByText('2 records added in the past year')).toBeInTheDocument();
		const list = screen.getByRole('list', { name: 'Records added each month in the past year' });
		expect(within(list).getByText('November 2025: 1 record')).toBeInTheDocument();
	});

	it('does not draw the days of the first week before the year starts', () => {
		render(CollectingCalendar, { props: { items: [] } });
		const grid = screen.getByRole('grid');
		// The first week runs Sunday 9 to Saturday 15 November 2025; the year starts on the Friday.
		for (const d of ['Sun, Nov 9', 'Mon, Nov 10', 'Tue, Nov 11', 'Wed, Nov 12', 'Thu, Nov 13']) {
			expect(within(grid).queryByRole('gridcell', { name: new RegExp(`^${d}, 2025`) })).toBeNull();
		}
		expect(within(grid).getByRole('gridcell', { name: 'Fri, Nov 14, 2025: no records' })).toBeInTheDocument();
		// Each drawn day keeps its week's column.
		const sundays = within(within(grid).getAllByRole('row')[0]).getAllByRole('gridcell');
		expect(sundays[0]).toHaveAccessibleName('Sun, Nov 16, 2025: no records');
		expect(sundays[0].style.gridColumn).toMatch(/^2( \/ auto)?$/);
	});

	it('keeps keys off the undrawn days: up and left from the first day stay, Ctrl+Home goes to it', async () => {
		render(CollectingCalendar, { props: { items: [] } });
		const grid = screen.getByRole('grid');
		const focused = () => document.activeElement?.getAttribute('aria-label');
		(grid.querySelector('[tabindex="0"]') as HTMLElement).focus();
		await fireEvent.keyDown(document.activeElement!, { key: 'Home', ctrlKey: true });
		expect(focused()).toBe('Fri, Nov 14, 2025: no records');
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
		expect(focused()).toBe('Fri, Nov 14, 2025: no records');
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
		expect(focused()).toBe('Fri, Nov 14, 2025: no records');
		await fireEvent.keyDown(document.activeElement!, { key: 'Home' }); // Friday's row starts on the first day
		expect(focused()).toBe('Fri, Nov 14, 2025: no records');
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' }); // Thursday 13th is not drawn
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
		await fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
		expect(focused()).toBe('Fri, Nov 14, 2025: no records');
	});

	it('leaves Alt and Cmd with an arrow to the browser (Back and Forward)', async () => {
		render(CollectingCalendar, { props: { items: [addedOn(2026, 10, 9)] } });
		const grid = screen.getByRole('grid');
		const day = grid.querySelector('[tabindex="0"]') as HTMLElement;
		day.focus();
		for (const init of [{ altKey: true }, { metaKey: true }]) {
			for (const key of ['ArrowLeft', 'ArrowRight']) {
				const notCancelled = await fireEvent.keyDown(day, { key, ...init });
				expect(notCancelled).toBe(true);
				expect(document.activeElement).toBe(day);
			}
		}
		// Without them the arrow moves the day.
		expect(await fireEvent.keyDown(day, { key: 'ArrowLeft' })).toBe(false);
		expect(document.activeElement).toHaveAccessibleName('Mon, Nov 2, 2026: no records');
	});
});
