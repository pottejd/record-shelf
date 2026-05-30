import { describe, it, expect } from 'vitest';
import { escapeCsvCell } from './csv';

describe('escapeCsvCell', () => {
	it('leaves a plain value unchanged', () => {
		expect(escapeCsvCell('Hello')).toBe('Hello');
	});

	it('quotes values containing a comma', () => {
		expect(escapeCsvCell('a,b')).toBe('"a,b"');
	});

	it('doubles embedded quotes and wraps', () => {
		expect(escapeCsvCell('a"b')).toBe('"a""b"');
	});

	it('quotes values containing newlines', () => {
		expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
	});

	it('stringifies numbers without quoting', () => {
		expect(escapeCsvCell(2024)).toBe('2024');
	});

	it('returns empty string unchanged', () => {
		expect(escapeCsvCell('')).toBe('');
	});

	describe('formula-injection neutralization', () => {
		it('prefixes a leading = with a single quote', () => {
			expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
		});

		it('prefixes leading + - @ as well', () => {
			expect(escapeCsvCell('+1')).toBe("'+1");
			expect(escapeCsvCell('-1+2')).toBe("'-1+2");
			expect(escapeCsvCell('@cmd')).toBe("'@cmd");
		});

		it('prefixes a leading tab', () => {
			expect(escapeCsvCell('\tx')).toBe("'\tx");
		});

		it('prefixes a leading carriage return and RFC-quotes it', () => {
			// CR must be quoted per RFC-4180, and the leading char is neutralized first
			expect(escapeCsvCell('\rx')).toBe('"\'\rx"');
		});

		it('neutralizes AND quotes a formula that also contains a comma', () => {
			expect(escapeCsvCell('=HYPERLINK("x"),y')).toBe('"\'=HYPERLINK(""x""),y"');
		});

		it('does not prefix a formula char that is not leading', () => {
			expect(escapeCsvCell('a=b')).toBe('a=b');
		});
	});
});
