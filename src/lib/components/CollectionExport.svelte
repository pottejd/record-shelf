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

	// Open a clean, printable list (Print → Save as PDF for an insurance record).
	// Built with DOM + textContent so Discogs-supplied strings can't inject markup.
	function printList() {
		const w = window.open('', '_blank');
		if (!w) return;
		const d = w.document;
		d.title = `${username} — Record Shelf collection`;

		const style = d.createElement('style');
		style.textContent =
			'body{font-family:system-ui,sans-serif;margin:2rem;color:#111}h1{font-size:1.25rem}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f3f3f3}@media print{@page{margin:1.5cm}}';
		d.head.appendChild(style);

		const h1 = d.createElement('h1');
		h1.textContent = `${username} — Record Collection (${items.length} items)`;
		d.body.appendChild(h1);

		const table = d.createElement('table');
		const thead = d.createElement('thead');
		const headRow = d.createElement('tr');
		for (const label of ['Artist', 'Title', 'Year', 'Format', 'Catalog #']) {
			const th = d.createElement('th');
			th.textContent = label;
			headRow.appendChild(th);
		}
		thead.appendChild(headRow);
		table.appendChild(thead);

		const tbody = d.createElement('tbody');
		for (const item of items) {
			const info = item.basic_information;
			const cells = [
				formatArtists(info.artists),
				info.title,
				info.year ? String(info.year) : '',
				info.formats.map((f) => f.name).join(', '),
				info.labels.map((l) => l.catno).filter(Boolean).join(', ')
			];
			const tr = d.createElement('tr');
			for (const value of cells) {
				const td = d.createElement('td');
				td.textContent = value;
				tr.appendChild(td);
			}
			tbody.appendChild(tr);
		}
		table.appendChild(tbody);
		d.body.appendChild(table);

		w.focus();
		w.print();
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
	<button class="export-btn" onclick={printList}>
		<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="6 9 6 2 18 2 18 9" />
			<path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
			<rect x="6" y="14" width="12" height="8" />
		</svg>
		Print / Insurance List
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
