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
const formatData = [
	{ label: 'Vinyl', value: 2 },
	{ label: 'CD', value: 1 }
];

describe('FormatBreakdown', () => {
	it('lists a row per format with count and percent', () => {
		render(FormatBreakdown, { props: { items, formatData, onFilter: vi.fn() } });
		expect(screen.getByRole('img')).toHaveAccessibleName('By format: Vinyl 67%, CD 33%');
		expect(screen.getByText('67%')).toBeTruthy();
	});

	it('opens the side list for a whole format and for a sub-format', async () => {
		const onFilter = vi.fn();
		render(FormatBreakdown, { props: { items, formatData, onFilter } });
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
