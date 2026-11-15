// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { CollectionStats } from '$lib/types/discogs';
import { computeCollectionStats } from '$lib/api/discogs';
import AtAGlance from './AtAGlance.svelte';

function stats(over: Partial<CollectionStats> = {}): CollectionStats {
	return {
		...computeCollectionStats([]),
		totalItems: 1234,
		totalArtists: 82,
		totalLabels: 10,
		averageYear: 1984,
		collectionSpan: 69,
		dominantGenre: 'Rock',
		...over
	};
}

const row = (label: string) => screen.getByText(label).closest('.row') as HTMLElement;

describe('AtAGlance', () => {
	it('shows the six facts in order', () => {
		const { container } = render(AtAGlance, { props: { stats: stats(), badges: [] } });
		const labels = [...container.querySelectorAll('dt')].map((dt) => dt.textContent);
		expect(labels).toEqual(['Records', 'Artists', 'Labels', 'Average year', 'Year span', 'Top genre']);
		expect(row('Year span')).toHaveTextContent('69 years');
		expect(row('Top genre')).toHaveTextContent('Rock');
		expect(row('Average year')).toHaveTextContent('1984');
	});

	it('shows the record count as the big figure', () => {
		render(AtAGlance, { props: { stats: stats(), badges: [] } });
		const value = row('Records').querySelector('dd')!;
		expect(value).toHaveTextContent('1,234');
		expect(value).toHaveClass('figure');
	});

	it('lists the badges on one line', () => {
		render(AtAGlance, {
			props: {
				stats: stats(),
				badges: [
					{ label: 'Explorer', style: 'primary' },
					{ label: '90s kid', style: 'era' }
				]
			}
		});
		expect(screen.getByText('Explorer, 90s kid')).toHaveClass('small');
	});

	it('shows a dash for a missing value', () => {
		render(AtAGlance, {
			props: { stats: stats({ averageYear: 0, collectionSpan: 0, dominantGenre: '' }), badges: [] }
		});
		expect(row('Average year').querySelector('dd')).toHaveTextContent(/^—$/);
		expect(row('Year span').querySelector('dd')).toHaveTextContent(/^—$/);
		expect(row('Top genre').querySelector('dd')).toHaveTextContent(/^—$/);
	});
});
