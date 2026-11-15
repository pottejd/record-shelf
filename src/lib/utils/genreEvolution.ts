import type { DiscogsCollectionItem } from '$lib/types/discogs';
import type { ChartDatum } from '$lib/utils/chart';

export interface EvolutionYear {
	year: number;
	/** Records added that year. */
	total: number;
	/** One part per entry of `genres`, in that order (0 allowed), then 'Other' when above 0. */
	parts: ChartDatum[];
}

const YEARS_SHOWN = 5;
const GENRES_SHOWN = 5;

/**
 * Genres by year added for the last five years that have additions. The five
 * most common genres across those years together are fixed for every row, so a
 * genre never changes place (or colour) between years; the rest fold into 'Other'.
 * A record counts once for each of its genres.
 */
export function genreEvolution(items: DiscogsCollectionItem[]): { genres: string[]; years: EvolutionYear[] } {
	const byYear = new Map<number, { total: number; counts: Map<string, number> }>();
	for (const item of items) {
		const year = new Date(item.date_added).getFullYear();
		const entry = byYear.get(year) ?? { total: 0, counts: new Map<string, number>() };
		entry.total++;
		for (const genre of item.basic_information.genres || []) {
			entry.counts.set(genre, (entry.counts.get(genre) ?? 0) + 1);
		}
		byYear.set(year, entry);
	}

	const shown = [...byYear.keys()].filter((y) => !Number.isNaN(y)).sort((a, b) => a - b).slice(-YEARS_SHOWN);

	const combined = new Map<string, number>();
	for (const year of shown) {
		for (const [genre, n] of byYear.get(year)!.counts) combined.set(genre, (combined.get(genre) ?? 0) + n);
	}
	const genres = [...combined.entries()]
		.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
		.slice(0, GENRES_SHOWN)
		.map(([genre]) => genre);

	const years = shown.map((year) => {
		const { total, counts } = byYear.get(year)!;
		const parts: ChartDatum[] = genres.map((genre) => ({ label: genre, value: counts.get(genre) ?? 0 }));
		let other = 0;
		for (const [genre, n] of counts) if (!genres.includes(genre)) other += n;
		if (other > 0) parts.push({ label: 'Other', value: other });
		return { year, total, parts };
	});

	return { genres, years };
}
