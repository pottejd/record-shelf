// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BarChart from './BarChart.svelte';

const data = [{ label: '2025', value: 119 }, { label: '2026', value: 1234 }];

describe('BarChart', () => {
	for (const horizontal of [false, true]) {
		const form = horizontal ? 'rows' : 'columns';

		it(`draws ${form} that open nothing as plain text, not buttons`, () => {
			const { container } = render(BarChart, { props: { data, horizontal } });
			expect(screen.queryAllByRole('button')).toHaveLength(0);
			expect(container.querySelectorAll('button')).toHaveLength(0);
			const bars = container.querySelectorAll('.bar-container');
			expect(bars).toHaveLength(2);
			expect(bars[0]).toHaveTextContent('2025');
			expect(bars[0]).toHaveTextContent('119');
			expect(bars[1]).toHaveTextContent('1,234');
		});

		it(`draws clickable ${form} as buttons that open their label`, async () => {
			const onItemClick = vi.fn();
			render(BarChart, { props: { data, horizontal, clickable: true, onItemClick } });
			const buttons = screen.getAllByRole('button');
			expect(buttons).toHaveLength(2);
			for (const b of buttons) expect(b).toBeEnabled();
			await fireEvent.click(buttons[1]);
			expect(onItemClick).toHaveBeenCalledWith('2026');
		});
	}
});
