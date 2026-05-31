import { describe, it, expect } from 'vitest';
import { shuffleArray, sampleN } from './array';

describe('shuffleArray', () => {
	it('returns a new array, not the same reference', () => {
		const input = [1, 2, 3];
		expect(shuffleArray(input)).not.toBe(input);
	});

	it('does not mutate the input', () => {
		const input = [1, 2, 3, 4, 5];
		const copy = [...input];
		shuffleArray(input);
		expect(input).toEqual(copy);
	});

	it('preserves length and all elements (same multiset)', () => {
		const input = ['a', 'b', 'c', 'd', 'a'];
		const result = shuffleArray(input);
		expect(result).toHaveLength(input.length);
		expect([...result].sort()).toEqual([...input].sort());
	});

	it('handles empty and single-element arrays', () => {
		expect(shuffleArray([])).toEqual([]);
		expect(shuffleArray([42])).toEqual([42]);
	});
});

describe('sampleN', () => {
	it('returns n elements when the array is longer than n', () => {
		expect(sampleN([1, 2, 3, 4, 5], 3)).toHaveLength(3);
	});

	it('returns distinct elements that all come from the input', () => {
		const input = [1, 2, 3, 4, 5, 6, 7, 8];
		const result = sampleN(input, 4);
		expect(new Set(result).size).toBe(4); // no duplicates
		for (const x of result) expect(input).toContain(x);
	});

	it('returns all elements (shuffled) when n >= length', () => {
		const input = [1, 2, 3];
		const result = sampleN(input, 10);
		expect([...result].sort()).toEqual([1, 2, 3]);
	});

	it('does not mutate the input', () => {
		const input = [1, 2, 3, 4, 5];
		const copy = [...input];
		sampleN(input, 2);
		expect(input).toEqual(copy);
	});

	it('returns an empty array for n = 0 or an empty input', () => {
		expect(sampleN([1, 2, 3], 0)).toEqual([]);
		expect(sampleN([], 5)).toEqual([]);
	});
});
