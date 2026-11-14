import type { DiscogsCollectionItem } from '$lib/types/discogs';
import { UNIQUE_RECORDS_PREVIEW, SHARED_ARTISTS_PREVIEW, GENRE_OVERLAP_LIMIT } from '$lib/constants';
import { cleanArtistName } from '$lib/utils/discogs';

export interface Comparison {
	overlap: DiscogsCollectionItem[];
	uniqueTo1: DiscogsCollectionItem[];
	uniqueTo2: DiscogsCollectionItem[];
	overlapCount: number;
	similarityScore: number;
	sharedArtistsCount: number;
	sharedArtists: string[];
	genres1: Record<string, number>;
	genres2: Record<string, number>;
	sharedGenres: string[];
	genreOverlap: Array<{ genre: string; count1: number; count2: number }>;
	decades1: Record<string, number>;
	decades2: Record<string, number>;
}

/** A normalized album key: the master release, else the cleaned first artist and title. */
function getAlbumKey(item: DiscogsCollectionItem): string {
	if (item.basic_information.master_id) {
		return `master:${item.basic_information.master_id}`;
	}
	const title = item.basic_information.title.toLowerCase().trim();
	const artist = cleanArtistName((item.basic_information.artists?.[0]?.name ?? '').toLowerCase()).trim();
	return `title:${artist}:${title}`;
}

/** First item per album key, in collection order. */
function albumMap(items: DiscogsCollectionItem[]): Map<string, DiscogsCollectionItem> {
	const keys = new Map<string, DiscogsCollectionItem>();
	for (const item of items) {
		const key = getAlbumKey(item);
		if (!keys.has(key)) keys.set(key, item);
	}
	return keys;
}

function countGenres(items: DiscogsCollectionItem[]): Map<string, number> {
	const genres = new Map<string, number>();
	for (const item of items) {
		for (const genre of item.basic_information.genres || []) {
			genres.set(genre, (genres.get(genre) || 0) + 1);
		}
	}
	return genres;
}

function computeGenreOverlap(g1: Map<string, number>, g2: Map<string, number>) {
	const allGenres = new Set([...g1.keys(), ...g2.keys()]);
	return [...allGenres]
		.map((genre) => ({
			genre,
			count1: g1.get(genre) || 0,
			count2: g2.get(genre) || 0
		}))
		.sort((a, b) => b.count1 + b.count2 - (a.count1 + a.count2))
		.slice(0, GENRE_OVERLAP_LIMIT);
}

function computeDecades(items: DiscogsCollectionItem[]): Record<string, number> {
	const decades: Record<string, number> = {};
	for (const item of items) {
		const year = item.basic_information.year;
		if (year > 0) {
			const decade = `${Math.floor(year / 10) * 10}s`;
			decades[decade] = (decades[decade] || 0) + 1;
		}
	}
	return decades;
}

/** Head-to-head comparison of two full collections. */
export function compareCollections(items1: DiscogsCollectionItem[], items2: DiscogsCollectionItem[]): Comparison {
	const keys1 = albumMap(items1);
	const keys2 = albumMap(items2);

	const overlap: DiscogsCollectionItem[] = [];
	const uniqueTo1: DiscogsCollectionItem[] = [];
	for (const [key, item] of keys1) {
		if (keys2.has(key)) {
			overlap.push(item);
		} else {
			uniqueTo1.push(item);
		}
	}
	const uniqueTo2 = [...keys2.entries()].filter(([key]) => !keys1.has(key)).map(([, item]) => item);

	const genres1 = countGenres(items1);
	const genres2 = countGenres(items2);

	// Taste similarity: Jaccard index over distinct albums.
	const totalUniqueAlbums = new Set([...keys1.keys(), ...keys2.keys()]).size;
	const jaccardIndex = totalUniqueAlbums > 0 ? overlap.length / totalUniqueAlbums : 0;

	const artists1 = new Set(items1.flatMap((i) => (i.basic_information.artists ?? []).map((a) => a.name)));
	const artists2 = new Set(items2.flatMap((i) => (i.basic_information.artists ?? []).map((a) => a.name)));
	const sharedArtists = [...artists1].filter((a) => artists2.has(a));

	return {
		overlap,
		uniqueTo1: uniqueTo1.slice(0, UNIQUE_RECORDS_PREVIEW),
		uniqueTo2: uniqueTo2.slice(0, UNIQUE_RECORDS_PREVIEW),
		overlapCount: overlap.length,
		similarityScore: Math.round(jaccardIndex * 100),
		sharedArtistsCount: sharedArtists.length,
		sharedArtists: sharedArtists.slice(0, SHARED_ARTISTS_PREVIEW),
		genres1: Object.fromEntries(genres1),
		genres2: Object.fromEntries(genres2),
		sharedGenres: [...genres1.keys()].filter((g) => genres2.has(g)),
		genreOverlap: computeGenreOverlap(genres1, genres2),
		decades1: computeDecades(items1),
		decades2: computeDecades(items2)
	};
}
