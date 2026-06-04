import { describe, it, expect } from 'vitest';
import { shuffleArray } from './array';

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
