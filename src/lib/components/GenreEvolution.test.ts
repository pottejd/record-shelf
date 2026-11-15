// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import GenreEvolution from './GenreEvolution.svelte';

const item = (added: string, genres: string[]) =>
	({ date_added: added, basic_information: { genres } }) as any;

describe('GenreEvolution', () => {
	it('gives each year row its genres and counts as text', () => {
		render(GenreEvolution, {
			props: {
				items: [
					item('2024-03-01T12:00:00Z', ['Rock']),
					item('2024-05-01T12:00:00Z', ['Rock']),
					item('2024-07-01T12:00:00Z', ['Jazz']),
					item('2025-02-01T12:00:00Z', ['Jazz'])
				]
			}
		});
		const row2024 = screen.getByRole('list', { name: '2024 by genre' });
		expect(within(row2024).getByText('Rock: 2 (67%)')).toBeInTheDocument();
		expect(within(row2024).getByText('Jazz: 1 (33%)')).toBeInTheDocument();
		const row2025 = screen.getByRole('list', { name: '2025 by genre' });
		expect(within(row2025).getByText('Jazz: 1 (100%)')).toBeInTheDocument();
	});
});
