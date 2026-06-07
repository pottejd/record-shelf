// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ValueEstimate from './ValueEstimate.svelte';

function makeItems(n: number) {
	return Array.from({ length: n }, (_, i) => ({
		instance_id: i + 1,
		basic_information: { id: i + 1, title: `Album ${i + 1}`, artists: [{ name: 'Artist' }] }
	})) as any;
}

describe('ValueEstimate component', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('estimates and extrapolates the value across the full collection', async () => {
		const valuePayload = {
			totalValue: 200,
			pricedCount: 20,
			totalRequested: 20,
			currency: 'USD',
			results: Array.from({ length: 20 }, (_, i) => ({
				releaseId: i + 1,
				lowestPrice: 10,
				currency: 'USD'
			}))
		};
		const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
			if (url.includes('/api/value-history/')) {
				return { ok: true, json: async () => ({ history: [] }) } as any;
			}
			return { ok: true, json: async () => valuePayload } as any;
		});
		vi.stubGlobal('fetch', fetchMock);

		render(ValueEstimate, { props: { items: makeItems(40), username: 'tester' } });

		await fireEvent.click(screen.getByText('Estimate Value'));

		// avg = 200/20 = 10; extrapolated over 40 items = $400
		expect(await screen.findByText('$400')).toBeInTheDocument();
		expect(screen.getByText(/extrapolated from 20-item sample/)).toBeInTheDocument();

		// Posted to the value endpoint with at most 20 sampled ids
		const valueCall = fetchMock.mock.calls.find(([u]) => u.includes('/api/value/'));
		expect(valueCall).toBeTruthy();
		const body = JSON.parse((valueCall![1] as RequestInit).body as string);
		expect(body.releaseIds.length).toBeLessThanOrEqual(20);
	});

	it('shows an error message when the estimate request fails', async () => {
		const fetchMock = vi.fn(async () => ({
			ok: false,
			json: async () => ({ message: 'Discogs token required' })
		}) as any);
		vi.stubGlobal('fetch', fetchMock);

		render(ValueEstimate, { props: { items: makeItems(5), username: 'tester' } });

		await fireEvent.click(screen.getByText('Estimate Value'));

		expect(await screen.findByText('Discogs token required')).toBeInTheDocument();
	});
});
