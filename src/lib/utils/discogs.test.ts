import { describe, it, expect } from 'vitest';
import { cleanArtistName, formatArtists, itemSearchFields } from './discogs';

describe('cleanArtistName', () => {
	it('leaves a plain name unchanged', () => {
		expect(cleanArtistName('The Beatles')).toBe('The Beatles');
	});

	it('strips a trailing Discogs disambiguation number', () => {
		expect(cleanArtistName('Nirvana (2)')).toBe('Nirvana');
		expect(cleanArtistName('Artist (123)')).toBe('Artist');
	});

	it('only strips a number at the very end', () => {
		expect(cleanArtistName('No (2) Strip')).toBe('No (2) Strip');
	});

	it('does not strip non-numeric parentheticals', () => {
		expect(cleanArtistName('AC/DC')).toBe('AC/DC');
		expect(cleanArtistName('Album (Remastered)')).toBe('Album (Remastered)');
	});
});

describe('formatArtists', () => {
	it('joins cleaned artist names with a comma', () => {
		expect(formatArtists([{ name: 'A (2)' }, { name: 'B' }])).toBe('A, B');
	});

	it('returns an empty string for no artists', () => {
		expect(formatArtists([])).toBe('');
	});

	it('handles a single artist', () => {
		expect(formatArtists([{ name: 'Solo (3)' }])).toBe('Solo');
	});
});

describe('itemSearchFields', () => {
	function makeItem(overrides: Record<string, unknown> = {}) {
		return {
			basic_information: {
				title: 'Kind Of Blue',
				artists: [{ name: 'Miles Davis' }],
				labels: [{ name: 'Columbia', catno: 'CL 1355' }],
				...overrides
			}
		} as any;
	}

	it('lowercases title, artists, labels, and catalog numbers', () => {
		const fields = itemSearchFields(makeItem());
		expect(fields.title).toBe('kind of blue');
		expect(fields.artists).toBe('miles davis');
		expect(fields.labels).toBe('columbia');
		expect(fields.catno).toBe('cl 1355');
	});

	it('joins multiple artists and labels with spaces', () => {
		const fields = itemSearchFields(
			makeItem({
				artists: [{ name: 'A' }, { name: 'B' }],
				labels: [
					{ name: 'L1', catno: 'C1' },
					{ name: 'L2', catno: 'C2' }
				]
			})
		);
		expect(fields.artists).toBe('a b');
		expect(fields.labels).toBe('l1 l2');
		expect(fields.catno).toBe('c1 c2');
	});

	it('returns empty strings when labels are absent', () => {
		const fields = itemSearchFields(makeItem({ labels: undefined }));
		expect(fields.labels).toBe('');
		expect(fields.catno).toBe('');
	});
});
