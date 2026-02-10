import { json, error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { USER_AGENT } from '$lib/constants';

interface PriceSuggestion {
	[condition: string]: {
		currency: string;
		value: number;
	};
}

export const POST: RequestHandler = async ({ params, request }) => {
	const { username } = params;
	if (!username) throw error(400, 'Username is required');

	const body = await request.json();
	const releaseIds: number[] = body.releaseIds;

	if (!Array.isArray(releaseIds) || releaseIds.length === 0) {
		throw error(400, 'releaseIds array is required');
	}

	// Limit to prevent abuse
	const ids = releaseIds.slice(0, 50);

	const token = env.DISCOGS_TOKEN || request.headers.get('x-discogs-token') || '';
	if (!token) {
		throw error(401, 'Discogs token required for marketplace data');
	}

	const headers: Record<string, string> = {
		'User-Agent': USER_AGENT,
		'Authorization': `Discogs token=${token}`,
		'Accept': 'application/vnd.discogs.v2.discogs+json'
	};

	const results: Array<{ releaseId: number; lowestPrice: number | null; currency: string }> = [];

	// Fetch price suggestions for each release (with rate limit delay)
	for (const releaseId of ids) {
		try {
			const response = await fetch(
				`https://api.discogs.com/marketplace/price_suggestions/${releaseId}`,
				{ headers }
			);

			if (response.ok) {
				const data: PriceSuggestion = await response.json();
				// Use "Very Good Plus (VG+)" or "Near Mint (NM or M-)" as reference
				const vgPlus = data['Very Good Plus (VG+)'];
				const nearMint = data['Near Mint (NM or M-)'];
				const ref = nearMint || vgPlus;

				results.push({
					releaseId,
					lowestPrice: ref?.value ?? null,
					currency: ref?.currency ?? 'USD'
				});
			} else {
				results.push({ releaseId, lowestPrice: null, currency: 'USD' });
			}
		} catch {
			results.push({ releaseId, lowestPrice: null, currency: 'USD' });
		}

		// Rate limit: Discogs allows 60 req/min for authenticated users
		if (ids.indexOf(releaseId) < ids.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 1100));
		}
	}

	const totalValue = results.reduce((sum, r) => sum + (r.lowestPrice || 0), 0);
	const pricedCount = results.filter(r => r.lowestPrice !== null).length;
	const currency = results.find(r => r.currency)?.currency || 'USD';

	return json({
		totalValue,
		pricedCount,
		totalRequested: ids.length,
		currency,
		results
	});
};
