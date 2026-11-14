// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LoadingBanner from './LoadingBanner.svelte';

const base = { profile: null, items: [], totalItems: 1500, loaded: 400, phase: 'done', background: false, resumeAt: null, asOf: null, error: null, cooldownUntil: null } as any;
const show = (state: object, extra: object = {}) => render(LoadingBanner, { props: { state: { ...base, ...state }, onRetry: () => {}, ...extra } });

describe('LoadingBanner', () => {
	it('renders nothing when done', () => {
		const { container } = show({});
		expect(container.textContent?.trim()).toBe('');
	});
	it('loading', () => {
		show({ phase: 'loading' });
		expect(screen.getByText('Loading collection: 400 of 1500 records…')).toBeInTheDocument();
	});
	it('loading uses the label', () => {
		show({ phase: 'loading' }, { label: 'wantlist' });
		expect(screen.getByText('Loading wantlist: 400 of 1500 records…')).toBeInTheDocument();
	});
	it('waiting counts down from resumeAt', () => {
		vi.useFakeTimers(); vi.setSystemTime(1_000_000);
		show({ phase: 'waiting', resumeAt: 1_020_000 });
		expect(screen.getByText('Discogs is busy — resuming in 20s.')).toBeInTheDocument();
		vi.useRealTimers();
	});
	it('refreshing shows the age of the copy on screen', () => {
		vi.useFakeTimers(); vi.setSystemTime(100 * 3_600_000);
		show({ phase: 'refreshing', background: true, asOf: 93 * 3_600_000 });
		expect(screen.getByText('Showing a copy from 7 hours ago — updating (400 of 1500)…')).toBeInTheDocument();
		vi.useRealTimers();
	});
	it('refreshing without a completion time shows no age', () => {
		show({ phase: 'refreshing', background: true, asOf: null });
		expect(screen.getByText('Updating (400 of 1500)…')).toBeInTheDocument();
	});
	it('a network error shows what is on screen and a working Retry', async () => {
		const onRetry = vi.fn();
		show({ phase: 'error', error: { code: 'NETWORK', message: 'x' }, items: new Array(300) }, { onRetry });
		expect(screen.getByRole('alert')).toHaveTextContent("Couldn't reach Discogs — showing 300 of 1500 records.");
		await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		expect(onRetry).toHaveBeenCalled();
	});
	it('cooldown', () => {
		show({ cooldownUntil: Date.now() + 60_000 });
		expect(screen.getByText('Already refreshed in the last 10 minutes.')).toBeInTheDocument();
	});
});
