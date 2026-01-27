import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { DiscogsCollectionItem } from '$lib/types/discogs';

async function fetchCollection(username: string, token: string): Promise<{
	items: DiscogsCollectionItem[];
	profile: { username: string; avatar_url?: string };
}> {
	const headers = {
		'User-Agent': 'RecordShelf/1.0',
		Authorization: `Discogs token=${token}`
	};

	// Fetch profile
	const profileRes = await fetch(`https://api.discogs.com/users/${username}`, { headers });
	if (!profileRes.ok) {
		throw new Error(`User ${username} not found`);
	}
	const profile = await profileRes.json();

	// Fetch collection (first 500 items for comparison)
	const items: DiscogsCollectionItem[] = [];
	let page = 1;
	const maxPages = 5;

	while (page <= maxPages) {
		const res = await fetch(
			`https://api.discogs.com/users/${username}/collection/folders/0/releases?page=${page}&per_page=100&sort=added&sort_order=desc`,
			{ headers }
		);

		if (!res.ok) break;

		const data = await res.json();
		items.push(...data.releases);

		if (page >= data.pagination.pages) break;
		page++;
	}

	return {
		items,
		profile: {
			username: profile.username,
			avatar_url: profile.avatar_url
		}
	};
}

export const load: PageServerLoad = async ({ params, cookies }) => {
	const cookieToken = cookies.get('discogs_token');
	const token = cookieToken || env.DISCOGS_TOKEN;

	if (!token) {
		throw redirect(303, `/settings?redirect=/compare/${params.user1}/${params.user2}`);
	}

	try {
		const [collection1, collection2] = await Promise.all([
			fetchCollection(params.user1, token),
			fetchCollection(params.user2, token)
		]);

		// Helper to get a normalized album key for comparison
		// Uses master_id if available, otherwise falls back to normalized title + artist
		function getAlbumKey(item: DiscogsCollectionItem): string {
			if (item.basic_information.master_id) {
				return `master:${item.basic_information.master_id}`;
			}
			// Fallback: normalize title + primary artist
			const title = item.basic_information.title.toLowerCase().trim();
			const artist = item.basic_information.artists[0]?.name.toLowerCase().replace(/\s*\(\d+\)$/, '').trim() || '';
			return `title:${artist}:${title}`;
		}

		// Build lookup maps using album keys (master_id or title+artist)
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

		// Find overlap and unique items based on album (not specific release)
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

		// Calculate taste similarity (Jaccard index on albums)
		const allKeys = new Set([...keys1.keys(), ...keys2.keys()]);
		const totalUniqueAlbums = allKeys.size;
		const overlapCount = overlap.length;
		const jaccardIndex = totalUniqueAlbums > 0 ? overlapCount / totalUniqueAlbums : 0;

		// Artist overlap
		const artists1 = new Set(collection1.items.flatMap(i => i.basic_information.artists.map(a => a.name)));
		const artists2 = new Set(collection2.items.flatMap(i => i.basic_information.artists.map(a => a.name)));
		const sharedArtists = [...artists1].filter(a => artists2.has(a));

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
				genres2: Object.fromEntries(genres2)
			}
		};
	} catch (e) {
		throw error(404, e instanceof Error ? e.message : 'Failed to load collections');
	}
};
