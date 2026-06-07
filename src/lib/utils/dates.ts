/**
 * Local-timezone `YYYY-MM-DD` key for a date.
 *
 * Using `toISOString()` for day keys bins by UTC, which shifts the day for any
 * non-UTC offset (e.g. a record added at 8pm local in the US lands on the next
 * UTC day). Keying by the local calendar date keeps day/grid/labels consistent.
 */
export function localDayKey(d: Date): string {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Parse a `YYYY-MM-DD` key back into a local-midnight Date. `new Date('2024-03-09')`
 * parses as UTC midnight, so `.getMonth()`/formatting can read the wrong day in
 * negative offsets; constructing from parts pins it to the local calendar day.
 */
export function parseLocalDayKey(key: string): Date {
	const [year, month, day] = key.split('-').map(Number);
	return new Date(year, month - 1, day);
}
