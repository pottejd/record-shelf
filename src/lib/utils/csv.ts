// Leading characters that spreadsheet apps interpret as the start of a formula.
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escapes a value for a CSV cell:
 * 1. Neutralizes spreadsheet formula injection — a cell beginning with one of
 *    `= + - @`, tab or CR is prefixed with a single quote so Excel/Sheets treat
 *    it as text rather than executing it.
 * 2. Applies RFC-4180 quoting when the value contains a comma, quote or newline.
 */
export function escapeCsvCell(value: string | number): string {
	let s = String(value);

	if (s.length > 0 && FORMULA_TRIGGERS.includes(s[0])) {
		s = `'${s}`;
	}

	if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
		return `"${s.replace(/"/g, '""')}"`;
	}

	return s;
}
