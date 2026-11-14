import { describe, it, expect } from 'vitest';
import { compareCollections } from './compare';

const rec = (id: number, o: { master?: number; title?: string; artist?: string; genres?: string[]; year?: number } = {}) => ({
	id, instance_id: id, folder_id: 1, rating: 0, date_added: '',
	basic_information: {
		id, master_id: o.master, title: o.title ?? `T${id}`, year: o.year ?? 0, thumb: '', resource_url: '',
		artists: [{ id: 1, name: o.artist ?? 'A', resource_url: '' }], labels: [], formats: [], genres: o.genres ?? [], styles: []
	}
}) as any;

describe('compareCollections', () => {
	it('matches by master_id, and by cleaned artist + title when there is no master', () => {
		const c = compareCollections(
			[rec(1, { master: 10 }), rec(2, { title: 'Blue', artist: 'Joni (2)' }), rec(3, { title: 'Only1' })],
			[rec(4, { master: 10 }), rec(5, { title: 'blue ', artist: 'joni' }), rec(6, { title: 'Only2' })]
		);
		expect(c.overlapCount).toBe(2);
		expect(c.uniqueTo1.map((i) => i.id)).toEqual([3]);
		expect(c.uniqueTo2.map((i) => i.id)).toEqual([6]);
		expect(c.similarityScore).toBe(50); // 2 shared of 4 distinct albums
	});
	it('counts duplicates of one album once', () => {
		expect(compareCollections([rec(1, { master: 10 }), rec(2, { master: 10 })], [rec(3, { master: 10 })]).overlapCount).toBe(1);
	});
	it('caps unique previews at 20 and shared artists at 10', () => {
		const many = (from: number) => Array.from({ length: 30 }, (_, i) => rec(from + i, { title: `X${from + i}`, artist: `Artist ${i}` }));
		const c = compareCollections(many(1), many(1000));
		expect(c.uniqueTo1).toHaveLength(20);
		expect(c.uniqueTo2).toHaveLength(20);
		expect(c.sharedArtistsCount).toBe(30);
		expect(c.sharedArtists).toHaveLength(10);
	});
	it('builds genre overlap sorted by combined count, and decade counts ignoring year 0', () => {
		const c = compareCollections(
			[rec(1, { genres: ['Rock', 'Jazz'], year: 1975 }), rec(2, { genres: ['Rock'], year: 0 })],
			[rec(3, { genres: ['Jazz'], year: 1981 })]
		);
		expect(c.genreOverlap).toEqual([{ genre: 'Rock', count1: 2, count2: 0 }, { genre: 'Jazz', count1: 1, count2: 1 }]);
		expect(c.sharedGenres).toEqual(['Jazz']);
		expect(c.decades1).toEqual({ '1970s': 1 });
		expect(c.decades2).toEqual({ '1980s': 1 });
	});
	it('two empty collections: zero score, no division by zero', () => {
		expect(compareCollections([], [])).toMatchObject({ overlapCount: 0, similarityScore: 0, overlap: [] });
	});
});
