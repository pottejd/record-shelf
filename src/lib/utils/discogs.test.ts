import { describe, it, expect } from 'vitest';
import { cleanArtistName, formatArtists } from './discogs';

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
