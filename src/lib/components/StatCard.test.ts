// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import StatCard from './StatCard.svelte';

describe('StatCard', () => {
	it('formats numeric values with thousands separators', () => {
		render(StatCard, { props: { label: 'Records', value: 1234 } });
		expect(screen.getByText('1,234')).toBeInTheDocument();
		expect(screen.getByText('Records')).toBeInTheDocument();
	});

	it('renders string values unchanged', () => {
		render(StatCard, { props: { label: 'Top Genre', value: 'Jazz' } });
		expect(screen.getByText('Jazz')).toBeInTheDocument();
	});
});
