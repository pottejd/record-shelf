import { describe, it, expect } from 'vitest';
import { pickDistinctOptions } from './quiz';

describe('pickDistinctOptions', () => {
	it('includes the correct answer and fills distractors from the pool', () => {
		const opts = pickDistinctOptions('A', ['B', 'C', 'D', 'E']);
		expect(opts).toContain('A');
		expect(opts).toHaveLength(4);
	});

	it('caps the result at the requested count', () => {
		const opts = pickDistinctOptions('A', ['B', 'C', 'D', 'E', 'F'], 4);
		expect(opts).toHaveLength(4);
	});

	it('dedupes the pool and never repeats the correct answer', () => {
		const opts = pickDistinctOptions('A', ['A', 'B', 'B', 'C']);
		expect(opts.filter((o) => o === 'A')).toHaveLength(1);
		expect(new Set(opts).size).toBe(opts.length);
		expect(opts).toEqual(['A', 'B', 'C']);
	});

	it('skips blank candidates', () => {
		const opts = pickDistinctOptions('A', ['', 'B', '']);
		expect(opts).toEqual(['A', 'B']);
	});

	it('returns fewer than count when the pool is too small (caller rejects)', () => {
		expect(pickDistinctOptions('A', ['B']).length).toBeLessThan(4);
	});
});
