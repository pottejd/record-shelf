import { describe, it, expect } from 'vitest';
import { genreEvolution } from './genreEvolution';

const item = (added: string, genres: string[]) =>
	({ date_added: added, basic_information: { genres } }) as any;

const many = (n: number, added: string, genres: string[]) =>
	Array.from({ length: n }, () => item(added, genres));

describe('genreEvolution', () => {
	// Combined: Rock 10, Jazz 5, Pop 4, Folk 3, Funk 3, Soul 3 (the sixth, by name)
	const items = [
		...many(6, '2024-03-01T12:00:00Z', ['Rock']),
		...many(5, '2024-04-01T12:00:00Z', ['Jazz']),
		...many(1, '2024-05-01T12:00:00Z', ['Folk']),
		...many(4, '2025-03-01T12:00:00Z', ['Rock']),
		...many(4, '2025-04-01T12:00:00Z', ['Pop']),
		...many(3, '2025-05-01T12:00:00Z', ['Funk']),
		...many(3, '2025-06-01T12:00:00Z', ['Soul']),
		...many(2, '2025-07-01T12:00:00Z', ['Folk'])
	];

	it('takes the top five genres over the years together, ties by name', () => {
		expect(genreEvolution(items).genres).toEqual(['Rock', 'Jazz', 'Pop', 'Folk', 'Funk']);
	});

	it('lists the same five in the same order in every year', () => {
		const { genres, years } = genreEvolution(items);
		for (const y of years) expect(y.parts.slice(0, 5).map((p) => p.label)).toEqual(genres);
	});

	it('lands the sixth genre in Other, and leaves Other out when it is 0', () => {
		const { years } = genreEvolution(items);
		expect(years[0].parts).toHaveLength(5);
		expect(years[1].parts.at(-1)).toEqual({ label: 'Other', value: 3 });
		expect(years[1].parts.find((p) => p.label === 'Jazz')).toEqual({ label: 'Jazz', value: 0 });
	});

	it('gives a year with none of the five zero parts and everything in Other', () => {
		const { genres, years } = genreEvolution([
			...many(5, '2024-03-01T12:00:00Z', ['Rock']),
			...many(4, '2024-03-02T12:00:00Z', ['Jazz']),
			...many(3, '2024-03-03T12:00:00Z', ['Pop']),
			...many(3, '2024-03-04T12:00:00Z', ['Folk']),
			...many(3, '2024-03-05T12:00:00Z', ['Funk']),
			...many(2, '2025-03-01T12:00:00Z', ['Soul'])
		]);
		expect(genres).toEqual(['Rock', 'Jazz', 'Folk', 'Funk', 'Pop']);
		expect(years[1].total).toBe(2);
		expect(years[1].parts).toEqual([
			...genres.map((label) => ({ label, value: 0 })),
			{ label: 'Other', value: 2 }
		]);
	});

	it('counts a record once for each of its genres', () => {
		const { years } = genreEvolution([item('2024-03-01T12:00:00Z', ['Rock', 'Pop'])]);
		expect(years[0].total).toBe(1);
		expect(years[0].parts).toEqual([
			{ label: 'Pop', value: 1 },
			{ label: 'Rock', value: 1 }
		]);
	});

	it('keeps only the last five years that have additions, oldest first', () => {
		const { years } = genreEvolution(
			[2018, 2019, 2021, 2022, 2023, 2024, 2026].map((y) => item(`${y}-06-15T12:00:00Z`, ['Rock']))
		);
		expect(years.map((y) => y.year)).toEqual([2021, 2022, 2023, 2024, 2026]);
	});

	it('ignores genres from years that are not shown', () => {
		const { genres } = genreEvolution([
			...many(9, '2015-06-15T12:00:00Z', ['Blues']),
			...[2020, 2021, 2022, 2023, 2024].map((y) => item(`${y}-06-15T12:00:00Z`, ['Rock']))
		]);
		expect(genres).toEqual(['Rock']);
	});

	it('returns nothing for no items', () => {
		expect(genreEvolution([])).toEqual({ genres: [], years: [] });
	});
});
