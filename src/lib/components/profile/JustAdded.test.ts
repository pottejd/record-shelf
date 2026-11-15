// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { DiscogsCollectionItem } from '$lib/types/discogs';
import { makeCollection } from '../../../../e2e/fixtures/collection';
import JustAdded from './JustAdded.svelte';

/** Twelve records, newest-added first, as the loader hands them over. */
function newestFirst(): DiscogsCollectionItem[] {
	return makeCollection(12).map((item, i) => ({
		...item,
		date_added: new Date(Date.UTC(2026, 9, 30 - i)).toISOString(),
		basic_information: { ...item.basic_information, title: `Record ${i + 1}` }
	}));
}

const titles = () =>
	screen.getAllByRole('listitem').map((li) => li.querySelector('.title')?.textContent);

describe('JustAdded', () => {
	it('shows the three newest of twelve as rows', () => {
		const items = newestFirst();
		render(JustAdded, { props: { items, total: 679, allHref: '/u/someone?tab=records' } });
		expect(screen.getAllByRole('listitem')).toHaveLength(3);
		expect(titles()).toEqual(items.slice(0, 3).map((i) => i.basic_information.title));
		const first = screen.getAllByRole('listitem')[0];
		expect(first).toHaveTextContent(items[0].basic_information.artists[0].name);
	});

	it('links to all the records', () => {
		render(JustAdded, { props: { items: newestFirst(), total: 1234, allHref: '/u/someone?tab=records' } });
		const link = screen.getByRole('link', { name: 'See all 1,234 records' });
		expect(link).toHaveAttribute('href', '/u/someone?tab=records');
	});

	it('picks the newest by date added, whatever the order', () => {
		const items = newestFirst();
		const shuffled = [items[7], items[2], items[11], items[0], items[5], items[1], items[9], items[3]];
		render(JustAdded, { props: { items: shuffled, total: 8, allHref: '/x' } });
		expect(titles()).toEqual([items[0], items[1], items[2]].map((i) => i.basic_information.title));
		// The list it was handed is left as it was.
		expect(shuffled[0]).toBe(items[7]);
	});
});
