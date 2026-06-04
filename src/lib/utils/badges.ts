import type { CollectionStats } from '$lib/types/discogs';
import { BADGE_SIZE_THRESHOLDS } from '$lib/constants';

export interface Badge {
	label: string;
	style: 'primary' | 'era' | 'format' | 'size' | 'special';
}

/**
 * Derives the playful "personality" badges shown on a profile from its stats.
 * Extracted from the profile route so the branching logic is unit-testable.
 */
export function calculateBadges(s: CollectionStats): Badge[] {
	const result: Badge[] = [];

	// Collector type (Explorer, Devotee, Eclectic, Curator)
	if (s.uniqueArtistRatio > 0.8) result.push({ label: 'Explorer', style: 'primary' });
	else if (s.uniqueArtistRatio < 0.4) result.push({ label: 'Devotee', style: 'primary' });
	else if (Object.keys(s.genreBreakdown).length > 10)
		result.push({ label: 'Eclectic', style: 'primary' });
	else result.push({ label: 'Curator', style: 'primary' });

	// Era badge
	if (s.dominantDecade) {
		const decade = parseInt(s.dominantDecade);
		if (decade >= 2010) result.push({ label: 'Modern era', style: 'era' });
		else if (decade >= 2000) result.push({ label: 'Y2K era', style: 'era' });
		else if (decade >= 1990) result.push({ label: '90s kid', style: 'era' });
		else if (decade >= 1980) result.push({ label: '80s fan', style: 'era' });
		else if (decade >= 1970) result.push({ label: '70s purist', style: 'era' });
		else if (decade >= 1960) result.push({ label: '60s head', style: 'era' });
		else result.push({ label: 'Vintage hunter', style: 'era' });
	}

	// Collection size badge
	if (s.totalItems >= BADGE_SIZE_THRESHOLDS.HOARDER)
		result.push({ label: 'Hoarder', style: 'size' });
	else if (s.totalItems >= BADGE_SIZE_THRESHOLDS.SERIOUS)
		result.push({ label: 'Serious collector', style: 'size' });
	else if (s.totalItems >= BADGE_SIZE_THRESHOLDS.GROWING)
		result.push({ label: 'Growing collection', style: 'size' });
	else if (s.totalItems >= BADGE_SIZE_THRESHOLDS.STARTED)
		result.push({ label: 'Getting started', style: 'size' });

	// Format badge
	const vinylCount = s.formatBreakdown['Vinyl'] || 0;
	const cdCount = s.formatBreakdown['CD'] || 0;
	const cassetteCount = s.formatBreakdown['Cassette'] || 0;
	const vinylRatio = vinylCount / s.totalItems;
	const cdRatio = cdCount / s.totalItems;

	if (vinylRatio > 0.8) result.push({ label: 'Vinyl purist', style: 'format' });
	else if (vinylRatio > 0.5) result.push({ label: 'Vinyl lover', style: 'format' });
	else if (cdRatio > 0.5) result.push({ label: 'CD collector', style: 'format' });
	else if (cassetteCount > 10) result.push({ label: 'Tape head', style: 'format' });

	// Genre focus badge
	if (s.dominantGenre) {
		const topGenreCount = s.genreBreakdown[s.dominantGenre] || 0;
		const genreRatio = topGenreCount / s.totalItems;
		if (genreRatio > 0.5) {
			result.push({ label: `${s.dominantGenre} specialist`, style: 'special' });
		}
	}

	// Year span badge
	if (s.collectionSpan && s.collectionSpan >= 50) {
		result.push({ label: 'Time traveler', style: 'special' });
	}

	// Oldest release badge
	if (s.oldestRelease && s.oldestRelease.year && s.oldestRelease.year < 1970) {
		result.push({ label: 'Crate digger', style: 'special' });
	}

	// Label diversity
	if (s.totalLabels > 100) {
		result.push({ label: 'Label explorer', style: 'special' });
	}

	return result;
}
