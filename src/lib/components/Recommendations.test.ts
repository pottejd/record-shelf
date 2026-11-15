// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import type { CollectionStats } from '$lib/types/discogs';
import { computeCollectionStats } from '$lib/api/discogs';
import Recommendations from './Recommendations.svelte';

function stats(over: Partial<CollectionStats> = {}): CollectionStats {
	return { ...computeCollectionStats([]), dominantDecade: '1970s', dominantGenre: 'Rock', ...over };
}

describe('Recommendations', () => {
	it('names the sweet spot once, with the decade as given', () => {
		const { container } = render(Recommendations, { props: { stats: stats() } });
		expect(screen.getByText('1970s Rock')).toBeInTheDocument();
		expect(screen.getByText('Sweet spot: Rock from the 1970s')).toBeInTheDocument();
		expect(container.textContent).not.toContain('1970ss');
	});

	it('searches Discogs for the genre and the decade', () => {
		render(Recommendations, { props: { stats: stats() } });
		const link = screen.getByRole('link', { name: /1970s Rock/ });
		const url = new URL(link.getAttribute('href')!);
		expect(url.origin + url.pathname).toBe('https://www.discogs.com/search/');
		expect(link.getAttribute('href')).toContain('q=Rock%201970s&');
		expect(url.searchParams.get('type')).toBe('release');
	});
});
