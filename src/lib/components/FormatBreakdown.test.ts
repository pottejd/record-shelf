// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { DiscogsCollectionItem } from '$lib/types/discogs';
import FormatBreakdown from './FormatBreakdown.svelte';

function rec(id: number, name: string, descriptions: string[]): DiscogsCollectionItem {
	return {
		id,
		instance_id: id,
		basic_information: { id, formats: [{ name, qty: '1', descriptions }] }
	} as unknown as DiscogsCollectionItem;
}

const items = [rec(1, 'Vinyl', ['LP']), rec(2, 'Vinyl', ['LP', 'Album']), rec(3, 'CD', ['Album'])];

describe('FormatBreakdown', () => {
	it('lists a row per format with count and percent', () => {
		render(FormatBreakdown, { props: { items, onFilter: vi.fn() } });
		expect(screen.getByRole('img')).toHaveAccessibleName('By format: Vinyl 67%, CD 33%');
		expect(screen.getByText('67%')).toBeTruthy();
	});

	it('the bar and the rows count the same way, so the spoken and printed percents agree', () => {
		// A two-disc set listed as two Vinyl entries, and a CD that comes with a DVD.
		const set = {
			id: 10,
			instance_id: 10,
			basic_information: { id: 10, formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP'] }, { name: 'Vinyl', qty: '1', descriptions: ['LP'] }] }
		} as unknown as DiscogsCollectionItem;
		const withDvd = {
			id: 11,
			instance_id: 11,
			basic_information: { id: 11, formats: [{ name: 'CD', qty: '1', descriptions: ['Album'] }, { name: 'DVD', qty: '1', descriptions: [] }] }
		} as unknown as DiscogsCollectionItem;
		const all = [set, rec(12, 'Vinyl', ['LP']), withDvd, rec(13, 'CD', ['Album'])];
		// Counted per format entry this would be Vinyl 3, CD 2, DVD 1 (50%, 33%, 17%).
		const { container } = render(FormatBreakdown, { props: { items: all, onFilter: vi.fn() } });

		const rows = [...container.querySelectorAll('.format-row')].map((row) => ({
			name: row.querySelector('.format-name')!.textContent!.trim(),
			count: row.querySelector('.format-count')!.textContent!.trim(),
			percent: row.querySelector('.format-percent')!.textContent!.trim()
		}));
		// Records with each format: Vinyl 2, CD 2, DVD 1, of 5.
		expect(rows).toEqual([
			{ name: 'Vinyl', count: '2', percent: '40%' },
			{ name: 'CD', count: '2', percent: '40%' },
			{ name: 'DVD', count: '1', percent: '20%' }
		]);
		expect(screen.getByRole('img')).toHaveAccessibleName(
			`By format: ${rows.map((r) => `${r.name} ${r.percent}`).join(', ')}`
		);
	});

	it('opens the side list for a whole format and for a sub-format', async () => {
		const onFilter = vi.fn();
		render(FormatBreakdown, { props: { items, onFilter } });
		await fireEvent.click(screen.getByRole('button', { name: /Open the Vinyl records/ }));
		expect(onFilter).toHaveBeenLastCalledWith('Vinyl', [items[0], items[1]]);

		const toggle = screen.getByRole('button', { name: 'Show Vinyl sub-formats' });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await fireEvent.click(toggle);
		expect(screen.getByRole('button', { name: 'Hide Vinyl sub-formats' })).toHaveAttribute('aria-expanded', 'true');
		await fireEvent.click(screen.getByRole('button', { name: /^Album/ }));
		expect(onFilter).toHaveBeenLastCalledWith('Vinyl — Album', [items[1]]);
	});
});
