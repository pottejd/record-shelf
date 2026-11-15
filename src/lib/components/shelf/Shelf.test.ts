// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/svelte';
import type { DiscogsCollectionItem } from '$lib/types/discogs';
import { shelfOrder, splitShelves, shelfTitle } from '$lib/shelf/spines';
import { makeCollection } from '../../../../e2e/fixtures/collection';
import Shelf from './Shelf.svelte';

/** Both variants are in the page at once and CSS hides one; jsdom has no CSS, so tests pick one. */
function variant(container: HTMLElement, kind: 'wide' | 'narrow'): HTMLElement {
	const el = container.querySelector<HTMLElement>(`.shelf-${kind}`);
	if (!el) throw new Error(`no .shelf-${kind}`);
	return el;
}

const shelves = (el: HTMLElement) => within(el).queryAllByRole('button', { name: /^Shelf / });

function rec(id: number, title: string, artist: string, year: number): DiscogsCollectionItem {
	return {
		id,
		instance_id: id,
		folder_id: 1,
		rating: 0,
		date_added: '2020-01-01T00:00:00Z',
		basic_information: {
			id,
			title,
			year,
			thumb: '',
			resource_url: '',
			artists: [{ id: 1, name: artist, resource_url: '' }],
			labels: [],
			formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP'] }],
			genres: [],
			styles: []
		}
	} as DiscogsCollectionItem;
}

describe('Shelf', () => {
	it('lays out boards from the total before any record arrives', () => {
		const { container } = render(Shelf, { props: { items: [], total: 679, onOpen: vi.fn() } });
		expect(shelves(variant(container, 'wide'))).toHaveLength(3);
		expect(shelves(variant(container, 'narrow'))).toHaveLength(6);
		expect(container.querySelectorAll('[data-spine]')).toHaveLength(0);
	});

	it('names each shelf', () => {
		const items = makeCollection(679);
		const { container } = render(Shelf, { props: { items, total: 679, onOpen: vi.fn() } });
		const first = shelves(variant(container, 'wide'))[0];
		expect(first).toHaveAccessibleName(/^Shelf 1 of 3: \d+ records, \d{4} to \d{4}\. Open the list\.$/);
	});

	it('opens the side list with that shelf, oldest first', async () => {
		const items = makeCollection(679);
		const onOpen = vi.fn();
		const { container } = render(Shelf, { props: { items, total: 679, onOpen } });
		await fireEvent.click(shelves(variant(container, 'wide'))[1]);
		const row = splitShelves(shelfOrder(items), 3)[1];
		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(onOpen).toHaveBeenCalledWith(shelfTitle(row), row.map((s) => s.item));
	});

	it('caps a huge collection until asked', async () => {
		const items = makeCollection(5000);
		const { container } = render(Shelf, { props: { items, total: 5000, onOpen: vi.fn() } });
		const wide = variant(container, 'wide');
		expect(shelves(wide)).toHaveLength(6);
		expect(shelves(wide)[0]).toHaveAccessibleName(/^Shelf 1 of 22: /);
		expect(shelves(variant(container, 'narrow'))).toHaveLength(8);
		await fireEvent.click(within(wide).getByRole('button', { name: 'Show the whole shelf' }));
		expect(shelves(wide)).toHaveLength(22);
		expect(within(wide).queryByRole('button', { name: 'Show the whole shelf' })).toBeNull();
		expect(wide.querySelectorAll('[data-spine]')).toHaveLength(5000);
		// The narrow variant keeps its own cap.
		expect(shelves(variant(container, 'narrow'))).toHaveLength(8);
	});

	it('"Show the whole shelf" hands focus to the first new shelf, or to the shelf while the new ones are empty', async () => {
		const full = render(Shelf, { props: { items: makeCollection(5000), total: 5000, onOpen: vi.fn() } });
		const wide = variant(full.container, 'wide');
		await fireEvent.click(within(wide).getByRole('button', { name: 'Show the whole shelf' }));
		await vi.waitFor(() => expect(document.activeElement).toHaveAccessibleName(/^Shelf 7 of 22: /));
		full.unmount();

		// Nothing has arrived yet: every shelf is empty and disabled.
		const waiting = render(Shelf, { props: { items: [], total: 5000, onOpen: vi.fn() } });
		const empty = variant(waiting.container, 'wide');
		await fireEvent.click(within(empty).getByRole('button', { name: 'Show the whole shelf' }));
		await vi.waitFor(() => expect(document.activeElement).toBe(empty));
	});

	it('one board and a line for an empty collection', () => {
		const { container } = render(Shelf, { props: { items: [], total: 0, onOpen: vi.fn() } });
		for (const kind of ['wide', 'narrow'] as const) {
			const el = variant(container, kind);
			expect(el.querySelectorAll('.board')).toHaveLength(1);
			expect(within(el).queryAllByRole('button')).toHaveLength(0);
			expect(within(el).getByText('Nothing on the shelf yet.')).toBeInTheDocument();
		}
		expect(screen.queryByText('Oldest')).toBeNull();
	});

	it('a small collection does not stretch', () => {
		const items = makeCollection(10);
		const { container } = render(Shelf, { props: { items, total: 10, onOpen: vi.fn() } });
		const wide = variant(container, 'wide');
		expect(wide.querySelectorAll('.board')).toHaveLength(1);
		const spines = wide.querySelectorAll<HTMLElement>('[data-spine]');
		expect(spines).toHaveLength(10);
		for (const s of spines) expect(s.style.maxWidth).toMatch(/^calc\(/);
	});

	it('says "1 record" for a single record', () => {
		const { container } = render(Shelf, {
			props: { items: [rec(1, 'Only', 'Someone', 1971)], total: 1, onOpen: vi.fn() }
		});
		expect(shelves(variant(container, 'wide'))[0]).toHaveAccessibleName(
			'Shelf 1 of 1: 1 record, 1971. Open the list.'
		);
	});

	it('draws each spine from its record', () => {
		const { container } = render(Shelf, {
			props: { items: [rec(1, 'Only', 'Someone', 1971)], total: 1, onOpen: vi.fn() }
		});
		const spine = variant(container, 'wide').querySelector<HTMLElement>('[data-spine]')!;
		expect(spine).toHaveAttribute('aria-hidden', 'true');
		expect(spine.getAttribute('style')).toMatch(/background: var\(--spine-[1-9]\)/);
		expect(spine.style.height).toBe('100%');
	});

	it('names the record under the pointer, as text', async () => {
		const items = [rec(1, '<b>Loud</b>', 'Someone', 1971), rec(2, 'No year', 'Nobody', 0)];
		const { container } = render(Shelf, { props: { items, total: 2, onOpen: vi.fn() } });
		const wide = variant(container, 'wide');
		const label = container.querySelector<HTMLElement>('.spine-label')!;
		const [first, second] = wide.querySelectorAll<HTMLElement>('[data-spine]');

		await fireEvent.pointerMove(first, { pointerType: 'mouse', clientX: 10, clientY: 10 });
		expect(label).toBeVisible();
		expect(label.textContent).toBe('<b>Loud</b>, Someone (1971)');
		expect(label.querySelector('b')).toBeNull();

		await fireEvent.pointerMove(second, { pointerType: 'mouse', clientX: 20, clientY: 10 });
		expect(label.textContent).toBe('No year, Nobody');

		await fireEvent.pointerLeave(shelves(wide)[0], { pointerType: 'mouse' });
		expect(label).not.toBeVisible();
	});

	it('shows no label for touch', async () => {
		const items = [rec(1, 'Only', 'Someone', 1971)];
		const { container } = render(Shelf, { props: { items, total: 1, onOpen: vi.fn() } });
		const label = container.querySelector<HTMLElement>('.spine-label')!;
		const spine = variant(container, 'wide').querySelector<HTMLElement>('[data-spine]')!;
		await fireEvent.pointerMove(spine, { pointerType: 'touch', clientX: 10, clientY: 10 });
		expect(label).not.toBeVisible();
	});
});
