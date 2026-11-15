// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import GenreEvolution from './GenreEvolution.svelte';

const item = (added: string, genres: string[]) =>
	({ date_added: added, basic_information: { genres } }) as any;

const many = (n: number, added: string, genres: string[]) =>
	Array.from({ length: n }, () => item(added, genres));

const items = [
	...many(3, '2024-03-01T12:00:00Z', ['Rock']),
	...many(1, '2024-04-01T12:00:00Z', ['Jazz']),
	...many(2, '2025-03-01T12:00:00Z', ['Jazz']),
	...many(1, '2025-04-01T12:00:00Z', ['Rock'])
];

const swatches = (list: HTMLElement) =>
	[...list.querySelectorAll<HTMLElement>('.swatch')].map((s) => s.style.background);

describe('GenreEvolution', () => {
	it('shows each year with its total and its genre counts as text', () => {
		render(GenreEvolution, { props: { items } });
		const row2024 = screen.getByRole('group', { name: '2024 by genre' });
		expect(within(row2024).getByText('Rock 3, Jazz 1')).toBeInTheDocument();
		expect(row2024.parentElement).toHaveTextContent('2024');
		expect(row2024.parentElement!.querySelector('.year-total')).toHaveTextContent(/^4$/);
		expect(within(screen.getByRole('group', { name: '2025 by genre' })).getByText('Rock 1, Jazz 2')).toBeInTheDocument();
	});

	it('makes the counts reachable by keyboard focus and keeps the bar name', () => {
		render(GenreEvolution, { props: { items } });
		const row = screen.getByRole('group', { name: '2024 by genre' });
		expect(row).toHaveAttribute('tabindex', '0');
		expect(within(row).getByRole('img')).toHaveAccessibleName('2024 by genre: Rock 75%, Jazz 25%');
	});

	it('lists each genre once in the legend, in order, with its colour', () => {
		render(GenreEvolution, { props: { items } });
		const legend = screen.getByRole('list');
		expect(within(legend).getAllByRole('listitem').map((li) => li.textContent?.trim())).toEqual(['Rock', 'Jazz']);
		expect(swatches(legend)).toEqual(['var(--chart-1)', 'var(--chart-2)']);
	});

	it('gives a genre the same colour slot in years with different mixes', () => {
		const mixed = [
			...many(4, '2024-03-01T12:00:00Z', ['Rock']),
			...many(1, '2024-04-01T12:00:00Z', ['Jazz']),
			...many(2, '2025-03-01T12:00:00Z', ['Jazz'])
		];
		render(GenreEvolution, { props: { items: mixed } });
		const colours = (year: string) =>
			[...screen.getByRole('group', { name: `${year} by genre` }).querySelectorAll<HTMLElement>('[data-segment]')].map(
				(s) => s.style.background
			);
		// Rock leads 2024 (slot 1); in 2025 it has no segment, and Jazz is still slot 2.
		expect(colours('2024')).toEqual(['var(--chart-1)', 'var(--chart-2)']);
		expect(colours('2025')).toEqual(['var(--chart-2)']);
	});

	it('adds Other to the legend only when a shown year has some', () => {
		const six = ['A', 'B', 'C', 'D', 'E', 'F'].flatMap((g, i) => many(10 - i, '2024-03-01T12:00:00Z', [g]));
		const { unmount } = render(GenreEvolution, { props: { items } });
		expect(screen.queryByText('Other')).not.toBeInTheDocument();
		unmount();
		render(GenreEvolution, { props: { items: six } });
		const legend = screen.getByRole('list');
		expect(within(legend).getByText('Other')).toBeInTheDocument();
		expect(swatches(legend).at(-1)).toBe('var(--chart-other)');
	});

	it('says so plainly when there are no additions', () => {
		render(GenreEvolution, { props: { items: [] } });
		expect(screen.getByText('Not enough data to show genre evolution')).toBeInTheDocument();
	});
});
