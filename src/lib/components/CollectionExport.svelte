<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';
	import { escapeCsvCell } from '$lib/utils/csv';

	let { items, username }: { items: DiscogsCollectionItem[]; username: string } = $props();

	function downloadJSON() {
		const data = items.map(item => ({
			id: item.basic_information.id,
			title: item.basic_information.title,
			artist: formatArtists(item.basic_information.artists),
			year: item.basic_information.year,
			genres: item.basic_information.genres,
			styles: item.basic_information.styles,
			formats: item.basic_information.formats.map(f => f.name).join(', '),
			labels: item.basic_information.labels.map(l => l.name).join(', '),
			catalog: item.basic_information.labels.map(l => l.catno).filter(Boolean).join(', '),
			rating: item.rating,
			date_added: item.date_added
		}));

		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		downloadBlob(blob, `${username}-collection.json`);
	}

	function downloadCSV() {
		const headers = ['ID', 'Title', 'Artist', 'Year', 'Genres', 'Styles', 'Format', 'Label', 'Catalog #', 'Rating', 'Date Added'];
		const rows = items.map(item => [
			item.basic_information.id,
			escapeCsvCell(item.basic_information.title),
			escapeCsvCell(formatArtists(item.basic_information.artists)),
			item.basic_information.year || '',
			escapeCsvCell((item.basic_information.genres || []).join(', ')),
			escapeCsvCell((item.basic_information.styles || []).join(', ')),
			escapeCsvCell(item.basic_information.formats.map(f => f.name).join(', ')),
			escapeCsvCell(item.basic_information.labels.map(l => l.name).join(', ')),
			escapeCsvCell(item.basic_information.labels.map(l => l.catno).filter(Boolean).join(', ')),
			item.rating || '',
			item.date_added.split('T')[0]
		].join(','));

		const csv = [headers.join(','), ...rows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		downloadBlob(blob, `${username}-collection.csv`);
	}

	function downloadBlob(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="export-actions">
	<button class="export-btn" onclick={downloadCSV}>
		<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</svg>
		Export CSV
	</button>
	<button class="export-btn" onclick={downloadJSON}>
		<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
			<polyline points="7 10 12 15 17 10" />
			<line x1="12" y1="15" x2="12" y2="3" />
		</svg>
		Export JSON
	</button>
</div>

<style>
	.export-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.export-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		font-size: 0.8125rem;
		font-weight: 500;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		color: var(--color-text);
		cursor: pointer;
		transition: background-color 0.15s, border-color 0.15s;
	}

	.export-btn:hover {
		background: var(--color-bg-tertiary);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.export-btn svg {
		width: 16px;
		height: 16px;
	}
</style>
