/**
 * Build up to `count` distinct quiz options that always include `correct`,
 * drawing distractors from `pool`.
 *
 * Dedupes via a Set, so a collection with duplicate titles/artists can't yield
 * a distractor identical to the correct answer (which would mis-score, since the
 * quiz matches the answer string). Returns fewer than `count` only when the pool
 * lacks enough distinct values — callers should treat that as an unusable
 * question and try another.
 */
export function pickDistinctOptions(correct: string, pool: string[], count = 4): string[] {
	const options = new Set<string>([correct]);
	for (const candidate of pool) {
		if (options.size >= count) break;
		if (candidate) options.add(candidate);
	}
	return Array.from(options);
}
