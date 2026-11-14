// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ValueEstimate from './ValueEstimate.svelte';
import { setPaceForTests } from '$lib/api/discogs';

function makeItems(n: number) {
	return Array.from({ length: n }, (_, i) => ({
		instance_id: i + 1,
		basic_information: { id: i + 1, title: `Album ${i + 1}`, artists: [{ name: 'Artist' }] }
	})) as any;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const releaseIdOf = (url: string) => Number(new URL(url).pathname.split('/').pop());

/**
 * Stubs the network: Discogs' price suggestions (answered by `price`, which may
 * throw) and this site's value-history endpoint. Anything else fails the test.
 */
function stubNetwork(price: (releaseId: number, n: number) => Response = () => json({ 'Near Mint (NM or M-)': { value: 10, currency: 'USD' } })) {
	const discogs: string[] = [];
	/** The Authorization header of each Discogs call. */
	const auth: Array<string | null> = [];
	const site: string[] = [];
	vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
		if (url.startsWith('https://api.discogs.com/marketplace/price_suggestions/')) {
			discogs.push(url);
			auth.push(new Headers(init?.headers).get('authorization'));
			return price(releaseIdOf(url), discogs.length);
		}
		if (url.startsWith('/api/value-history/')) {
			site.push(url);
			return json({ history: [] });
		}
		throw new Error(`unexpected fetch ${url}`);
	}));
	return { discogs, auth, site };
}

describe('ValueEstimate component', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		setPaceForTests(0);
		localStorage.clear();
		document.cookie = 'discogs_token=visitor%20token;path=/';
	});

	afterEach(() => {
		setPaceForTests(null);
		vi.unstubAllGlobals();
		document.cookie = 'discogs_token=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
	});

	it('prices a sample straight from Discogs with the visitor\'s token and extrapolates across the collection', async () => {
		const net = stubNetwork();
		render(ValueEstimate, { props: { items: makeItems(40), username: 'tester' } });

		await fireEvent.click(screen.getByText('Estimate Value'));

		// avg = 200/20 = 10; extrapolated over 40 items = $400
		expect(await screen.findByText('$400')).toBeInTheDocument();
		expect(screen.getByText(/extrapolated from 20-item sample/)).toBeInTheDocument();

		expect(net.discogs).toHaveLength(20);
		expect(net.auth).toEqual(Array(20).fill('Discogs token=visitor token'));
		expect(net.discogs.some((url) => url.includes('token'))).toBe(false);
		// The finished estimate is recorded in value history.
		expect(net.site).toEqual(['/api/value-history/tester']);
	});

	it('without a token it says so and calls nothing', async () => {
		document.cookie = 'discogs_token=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
		const net = stubNetwork();
		render(ValueEstimate, { props: { items: makeItems(5), username: 'tester' } });

		await fireEvent.click(screen.getByText('Estimate Value'));

		expect(await screen.findByText('Discogs token required for marketplace data')).toBeInTheDocument();
		expect(net.discogs).toEqual([]);
	});

	it('shows an error message when Discogs rejects the token', async () => {
		const net = stubNetwork(() => json({}, 401));
		render(ValueEstimate, { props: { items: makeItems(5), username: 'tester' } });

		await fireEvent.click(screen.getByText('Estimate Value'));

		expect(await screen.findByText('Invalid or expired Discogs token')).toBeInTheDocument();
		expect(net.discogs).toHaveLength(1);
		expect(net.site).toEqual([]);
	});

	it('prices the same releases on every mount, regardless of item order, and remembers them in this browser', async () => {
		const net = stubNetwork();
		const first = render(ValueEstimate, { props: { items: makeItems(200), username: 'u' } });
		await fireEvent.click(screen.getByRole('button'));
		await screen.findByText(/Estimated collection value/);
		first.unmount();
		expect(net.discogs).toHaveLength(20);

		const second = render(ValueEstimate, { props: { items: makeItems(200).reverse(), username: 'u' } });
		await fireEvent.click(screen.getByRole('button'));
		await screen.findByText(/Estimated collection value/);
		second.unmount();
		// Same 20 releases, all remembered: no further Discogs call.
		expect(net.discogs).toHaveLength(20);
	});

	it('a partial estimate says so and is not recorded in value history', async () => {
		// What a browser sees when Discogs rate-limits: no readable answer.
		const net = stubNetwork((_id, n) => {
			if (n > 3) throw new TypeError('Failed to fetch');
			return json({ 'Near Mint (NM or M-)': { value: 10, currency: 'USD' } });
		});
		render(ValueEstimate, { props: { items: makeItems(200), username: 'u' } });
		await fireEvent.click(screen.getByRole('button'));
		expect(await screen.findByText('Discogs is busy — this is a partial estimate. Try again in a minute.')).toBeInTheDocument();
		expect(net.discogs).toHaveLength(4);
		expect(net.site).toEqual([]);
	});
});
