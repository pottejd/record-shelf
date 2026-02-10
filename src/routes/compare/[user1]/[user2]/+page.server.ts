import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { DiscogsCollectionItem } from '$lib/types/discogs';
import { USER_AGENT } from '$lib/constants';
import { fetchUserProfile, fetchUserCollection, DiscogsAPIError } from '$lib/api/discogs';
import { readCache, writeCache } from '$lib/server/cache';
import { computeCollectionStats } from '$lib/api/discogs';

export const load: PageServerLoad = async ({ params, platform, cookies }) => {
	const cookieToken = cookies.get('discogs_token');
	const token = cookieToken || env.DISCOGS_TOKEN;

	if (!token) {
		throw redirect(303, `/settings?redirect=/compare/${params.user1}/${params.user2}`);
	}

	const fetchOptions = { userAgent: USER_AGENT, token };

	async function getCollection(username: string): Promise<{
		items: DiscogsCollectionItem[];
		profile: { username: string; avatar_url?: string };
	}> {
		// Try cache first
		const cached = await readCache(platform, username);
		if (cached) {
			return {
				items: cached.data.items,
				profile: {
					username: cached.data.profile.username,
					avatar_url: cached.data.profile.avatar_url
				}
			};
		}

		// Fetch fresh using shared API module
		const profile = await fetchUserProfile(username, fetchOptions);
		const items = await fetchUserCollection(username, fetchOptions);

		// Cache the full collection for reuse
		const stats = computeCollectionStats(items);
		await writeCache(platform, username, {
			profile,
			items,
			stats,
			fetchedAt: Date.now()
		});

		return {
			items,
			profile: {
				username: profile.username,
				avatar_url: profile.avatar_url
			}
		};
	}

	try {
		const [collection1, collection2] = await Promise.all([
			getCollection(params.user1),
			getCollection(params.user2)
		]);

		// Helper to get a normalized album key for comparison
		function getAlbumKey(item: DiscogsCollectionItem): string {
			if (item.basic_information.master_id) {
				return `master:${item.basic_information.master_id}`;
			}
			const title = item.basic_information.title.toLowerCase().trim();
			const artist = item.basic_information.artists[0]?.name.toLowerCase().replace(/\s*\(\d+\)$/, '').trim() || '';
			return `title:${artist}:${title}`;
		}

		// Build lookup maps
		const keys1 = new Map<string, DiscogsCollectionItem>();
		const keys2 = new Map<string, DiscogsCollectionItem>();

		for (const item of collection1.items) {
			const key = getAlbumKey(item);
			if (!keys1.has(key)) keys1.set(key, item);
		}
		for (const item of collection2.items) {
			const key = getAlbumKey(item);
			if (!keys2.has(key)) keys2.set(key, item);
		}

		// Find overlap and unique items
		const overlap: DiscogsCollectionItem[] = [];
		const uniqueTo1: DiscogsCollectionItem[] = [];

		for (const [key, item] of keys1) {
			if (keys2.has(key)) {
				overlap.push(item);
			} else {
				uniqueTo1.push(item);
			}
		}

		const uniqueTo2 = [...keys2.entries()]
			.filter(([key]) => !keys1.has(key))
			.map(([, item]) => item);

		// Genre comparison
		const genres1 = new Map<string, number>();
		const genres2 = new Map<string, number>();

		for (const item of collection1.items) {
			for (const genre of item.basic_information.genres || []) {
				genres1.set(genre, (genres1.get(genre) || 0) + 1);
			}
		}
		for (const item of collection2.items) {
			for (const genre of item.basic_information.genres || []) {
				genres2.set(genre, (genres2.get(genre) || 0) + 1);
			}
		}

		// Calculate taste similarity (Jaccard index)
		const allKeys = new Set([...keys1.keys(), ...keys2.keys()]);
		const totalUniqueAlbums = allKeys.size;
		const overlapCount = overlap.length;
		const jaccardIndex = totalUniqueAlbums > 0 ? overlapCount / totalUniqueAlbums : 0;

		// Artist overlap
		const artists1 = new Set(collection1.items.flatMap(i => i.basic_information.artists.map(a => a.name)));
		const artists2 = new Set(collection2.items.flatMap(i => i.basic_information.artists.map(a => a.name)));
		const sharedArtists = [...artists1].filter(a => artists2.has(a));

		function computeGenreOverlap(g1: Map<string, number>, g2: Map<string, number>) {
			const allGenres = new Set([...g1.keys(), ...g2.keys()]);
			return [...allGenres].map(genre => ({
				genre,
				count1: g1.get(genre) || 0,
				count2: g2.get(genre) || 0
			})).sort((a, b) => (b.count1 + b.count2) - (a.count1 + a.count2)).slice(0, 10);
		}

		function computeDecades(items: DiscogsCollectionItem[]) {
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

		return {
			user1: {
				profile: collection1.profile,
				totalItems: collection1.items.length,
				items: collection1.items
			},
			user2: {
				profile: collection2.profile,
				totalItems: collection2.items.length,
				items: collection2.items
			},
			comparison: {
				overlap,
				uniqueTo1: uniqueTo1.slice(0, 20),
				uniqueTo2: uniqueTo2.slice(0, 20),
				overlapCount: overlap.length,
				similarityScore: Math.round(jaccardIndex * 100),
				sharedArtistsCount: sharedArtists.length,
				sharedArtists: sharedArtists.slice(0, 10),
				genres1: Object.fromEntries(genres1),
				genres2: Object.fromEntries(genres2),
				sharedGenres: [...genres1.keys()].filter(g => genres2.has(g)),
				genreOverlap: computeGenreOverlap(genres1, genres2),
				decades1: computeDecades(collection1.items),
				decades2: computeDecades(collection2.items)
			}
		};
	} catch (e) {
		if (e instanceof DiscogsAPIError) {
			if (e.code === 'NOT_FOUND') {
				throw error(404, e.message);
			}
			if (e.code === 'PRIVATE') {
				throw error(403, e.message);
			}
			if (e.code === 'RATE_LIMITED') {
				throw error(429, 'Rate limited by Discogs. Please try again in a minute.');
			}
			throw error(e.status, e.message);
		}
		throw error(404, e instanceof Error ? e.message : 'Failed to load collections');
	}
};
