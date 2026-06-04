import { describe, it, expect } from 'vitest';
import { calculateBadges } from './badges';
import type { CollectionStats } from '$lib/types/discogs';

function baseStats(overrides: Partial<CollectionStats> = {}): CollectionStats {
	return {
		totalItems: 10,
		totalArtists: 5,
		totalLabels: 0,
		formatBreakdown: {},
		formatDetailBreakdown: {},
		genreBreakdown: { Rock: 1 },
		styleBreakdown: {},
		decadeBreakdown: {},
		yearBreakdown: {},
		topArtists: [],
		topLabels: [],
		topStyles: [],
		recentlyAdded: [],
		addedByMonth: [],
		oldestRelease: null,
		newestRelease: null,
		averageYear: 0,
		medianYear: 0,
		uniqueArtistRatio: 0.5,
		collectionSpan: 0,
		dominantDecade: '',
		dominantGenre: '',
		ratingBreakdown: {},
		averageRating: 0,
		ratedCount: 0,
		topRatedItems: [],
		...overrides
	};
}

const labels = (s: CollectionStats) => calculateBadges(s).map((b) => b.label);

describe('calculateBadges', () => {
	describe('collector type', () => {
		it('Explorer when artist diversity is very high', () => {
			expect(labels(baseStats({ uniqueArtistRatio: 0.9 }))).toContain('Explorer');
		});
		it('Devotee when artist diversity is very low', () => {
			expect(labels(baseStats({ uniqueArtistRatio: 0.3 }))).toContain('Devotee');
		});
		it('Eclectic when mid diversity but many genres', () => {
			const genreBreakdown = Object.fromEntries(
				Array.from({ length: 11 }, (_, i) => [`g${i}`, 1])
			);
			expect(labels(baseStats({ uniqueArtistRatio: 0.5, genreBreakdown }))).toContain('Eclectic');
		});
		it('Curator otherwise', () => {
			expect(labels(baseStats())).toContain('Curator');
		});
	});

	describe('collection size', () => {
		it('Hoarder at 1000+', () => {
			expect(labels(baseStats({ totalItems: 1000 }))).toContain('Hoarder');
		});
		it('Getting started at 25', () => {
			expect(labels(baseStats({ totalItems: 25 }))).toContain('Getting started');
		});
		it('no size badge below the smallest threshold', () => {
			const result = labels(baseStats({ totalItems: 10 }));
			expect(result).not.toContain('Getting started');
			expect(result).not.toContain('Hoarder');
		});
	});

	describe('era', () => {
		it('90s kid when the dominant decade is the 1990s', () => {
			expect(labels(baseStats({ dominantDecade: '1990' }))).toContain('90s kid');
		});
		it('no era badge without a dominant decade', () => {
			const result = labels(baseStats({ dominantDecade: '' }));
			expect(result.some((l) => /era|kid|fan|purist|head|hunter/.test(l))).toBe(false);
		});
	});

	describe('format', () => {
		it('Vinyl purist when vinyl dominates', () => {
			expect(labels(baseStats({ totalItems: 10, formatBreakdown: { Vinyl: 9 } }))).toContain(
				'Vinyl purist'
			);
		});
	});

	describe('special badges', () => {
		it('genre specialist when one genre exceeds half the collection', () => {
			expect(
				labels(baseStats({ totalItems: 10, dominantGenre: 'Rock', genreBreakdown: { Rock: 6 } }))
			).toContain('Rock specialist');
		});
		it('Time traveler for a 50+ year span', () => {
			expect(labels(baseStats({ collectionSpan: 50 }))).toContain('Time traveler');
		});
		it('Crate digger when the oldest release predates 1970', () => {
			expect(labels(baseStats({ oldestRelease: { year: 1965 } as any }))).toContain('Crate digger');
		});
		it('Label explorer with 100+ labels', () => {
			expect(labels(baseStats({ totalLabels: 101 }))).toContain('Label explorer');
		});
	});
});
