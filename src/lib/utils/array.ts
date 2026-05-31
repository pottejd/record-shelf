/**
 * Returns a new array with the elements of `array` in random order
 * (Fisher-Yates). Does not mutate the input.
 */
export function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

/**
 * Returns up to `n` distinct random elements from `array` without mutating it.
 * Uses a partial Fisher-Yates so the cost is O(n) picks rather than shuffling
 * the whole array — cheap to call against a large collection.
 */
export function sampleN<T>(array: T[], n: number): T[] {
	const count = Math.min(Math.max(n, 0), array.length);
	const copy = [...array];
	const result: T[] = [];
	for (let i = 0; i < count; i++) {
		const j = i + Math.floor(Math.random() * (copy.length - i));
		[copy[i], copy[j]] = [copy[j], copy[i]];
		result.push(copy[i]);
	}
	return result;
}
