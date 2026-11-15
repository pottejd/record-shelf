<script lang="ts">
	import type { CollectionStats } from '$lib/types/discogs';
	import { LIGHT } from '$lib/theme/tokens';

	let { username, stats, badges = [] }: {
		username: string;
		stats: CollectionStats;
		badges?: { label: string; style: string }[];
	} = $props();

	let cardElement: HTMLDivElement | undefined = $state(undefined);
	let copied = $state(false);

	async function copyAsImage() {
		if (!cardElement) return;

		try {
			const text = `${username}'s Record Collection
${stats.totalItems} Records | ${stats.totalArtists} Artists | ${stats.totalLabels} Labels
Top Genre: ${stats.dominantGenre || 'Various'}
Dominant Era: ${stats.dominantDecade || 'Mixed'}
recordshelf.app/u/${username}`;

			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => copied = false, 2000);
		} catch {
			alert('Copy not supported in this browser');
		}
	}

	function downloadPNG() {
		const scale = 2;
		const w = 400;
		const h = 500;
		const canvas = document.createElement('canvas');
		canvas.width = w * scale;
		canvas.height = h * scale;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.scale(scale, scale);

		// The picture is always drawn in the light Shelf colours.
		ctx.fillStyle = LIGHT.ground;
		ctx.fillRect(0, 0, w, h);

		let y = 40;

		// Brand
		ctx.fillStyle = LIGHT.muted;
		ctx.font = '600 14px system-ui, -apple-system, sans-serif';
		ctx.fillText('Record Shelf', 24, y);
		y += 36;

		// Username
		ctx.fillStyle = LIGHT.ink;
		ctx.font = '700 28px system-ui, -apple-system, sans-serif';
		ctx.fillText(username, 24, y);
		y += 28;

		// Badges
		if (badges.length > 0) {
			y += 8;
			let bx = 24;
			ctx.font = '600 11px system-ui, -apple-system, sans-serif';
			for (const badge of badges.slice(0, 4)) {
				const tw = ctx.measureText(badge.label).width + 16;
				ctx.fillStyle = LIGHT.track;
				ctx.fillRect(bx, y - 12, tw, 22);
				ctx.fillStyle = LIGHT.ink;
				ctx.fillText(badge.label, bx + 8, y + 3);
				bx += tw + 6;
			}
			y += 28;
		}

		// Divider
		y += 8;
		ctx.fillStyle = LIGHT.hairline;
		ctx.fillRect(24, y, w - 48, 1);
		y += 20;

		// Stats row
		const statItems = [
			{ value: stats.totalItems.toLocaleString(), label: 'Records' },
			{ value: stats.totalArtists.toLocaleString(), label: 'Artists' },
			{ value: stats.totalLabels.toLocaleString(), label: 'Labels' }
		];
		const colW = (w - 48) / 3;
		for (let i = 0; i < statItems.length; i++) {
			const cx = 24 + colW * i + colW / 2;
			ctx.fillStyle = LIGHT.ink;
			ctx.font = '700 22px system-ui, -apple-system, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(statItems[i].value, cx, y);
			ctx.fillStyle = LIGHT.muted;
			ctx.font = '600 10px system-ui, -apple-system, sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(statItems[i].label.toUpperCase(), cx, y + 18);
		}
		ctx.textAlign = 'left';
		y += 40;

		// Divider
		ctx.fillStyle = LIGHT.hairline;
		ctx.fillRect(24, y, w - 48, 1);
		y += 24;

		// Highlights
		const highlights = [
			stats.dominantGenre ? ['Top Genre', stats.dominantGenre] : null,
			stats.dominantDecade ? ['Favorite Era', stats.dominantDecade] : null,
			stats.collectionSpan ? ['Year Span', stats.collectionSpan + ' years'] : null,
			stats.averageYear ? ['Avg. Year', String(stats.averageYear)] : null
		].filter(Boolean) as string[][];

		for (const [label, value] of highlights) {
			ctx.fillStyle = LIGHT.muted;
			ctx.font = '400 13px system-ui, -apple-system, sans-serif';
			ctx.fillText(label, 24, y);
			ctx.fillStyle = LIGHT.ink;
			ctx.font = '600 13px system-ui, -apple-system, sans-serif';
			ctx.textAlign = 'right';
			ctx.fillText(value, w - 24, y);
			ctx.textAlign = 'left';
			y += 24;
		}

		// Footer
		ctx.fillStyle = LIGHT.muted;
		ctx.font = '400 12px system-ui, -apple-system, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(`recordshelf.app/u/${username}`, w / 2, h - 24);
		ctx.textAlign = 'left';

		// Download
		const link = document.createElement('a');
		link.download = `${username}-record-shelf.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
	}

</script>

<div class="shareable-container">
	<div class="stats-card" bind:this={cardElement}>
		<div class="card-header">
			<svg aria-hidden="true" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="logo">
				<circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/>
				<circle cx="24" cy="24" r="12" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
				<circle cx="24" cy="24" r="3" fill="currentColor"/>
			</svg>
			<span class="brand">Record Shelf</span>
		</div>

		<div class="card-username">{username}</div>

		<div class="card-badges">
			{#each badges.slice(0, 4) as badge}
				<span class="card-badge">{badge.label}</span>
			{/each}
		</div>

		<div class="card-stats">
			<div class="card-stat">
				<span class="card-stat-value">{stats.totalItems.toLocaleString()}</span>
				<span class="card-stat-label">Records</span>
			</div>
			<div class="card-stat">
				<span class="card-stat-value">{stats.totalArtists.toLocaleString()}</span>
				<span class="card-stat-label">Artists</span>
			</div>
			<div class="card-stat">
				<span class="card-stat-value">{stats.totalLabels.toLocaleString()}</span>
				<span class="card-stat-label">Labels</span>
			</div>
		</div>

		<div class="card-highlights">
			{#if stats.dominantGenre}
				<div class="highlight-item">
					<span class="highlight-label">Top Genre</span>
					<span class="highlight-value">{stats.dominantGenre}</span>
				</div>
			{/if}
			{#if stats.dominantDecade}
				<div class="highlight-item">
					<span class="highlight-label">Favorite Era</span>
					<span class="highlight-value">{stats.dominantDecade}</span>
				</div>
			{/if}
			{#if stats.collectionSpan}
				<div class="highlight-item">
					<span class="highlight-label">Year Span</span>
					<span class="highlight-value">{stats.collectionSpan} years</span>
				</div>
			{/if}
		</div>

		<div class="card-footer">
			recordshelf.app/u/{username}
		</div>
	</div>

	<div class="share-actions">
		<button class="share-btn btn btn-secondary" onclick={copyAsImage}>
			{#if copied}
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="20 6 9 17 4 12" />
				</svg>
				Copied!
			{:else}
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
					<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
				</svg>
				Copy Text
			{/if}
		</button>
		<button class="share-btn btn btn-primary" onclick={downloadPNG}>
			<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
				<polyline points="7 10 12 15 17 10" />
				<line x1="12" y1="15" x2="12" y2="3" />
			</svg>
			Download PNG
		</button>
	</div>
</div>

<style>
	.shareable-container {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 24px 32px;
	}

	/* The card is drawn open in ink inside a 2px ink frame, square. */
	.stats-card {
		width: 100%;
		max-width: 340px;
		padding: 20px;
		border: 2px solid var(--ink);
		color: var(--ink);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}

	.logo {
		width: 24px;
		height: 24px;
		color: var(--ink);
	}

	.brand {
		font-size: 15px;
		font-weight: 700;
	}

	.card-username {
		font-size: 26px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.1;
		margin-bottom: 12px;
		overflow-wrap: anywhere;
	}

	.card-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		margin-bottom: 16px;
	}

	.card-badge {
		font-size: 15px;
		font-weight: 600;
	}

	.card-stats {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 0;
		border-top: 1px solid var(--hairline);
		border-bottom: 1px solid var(--hairline);
		margin-bottom: 12px;
	}

	.card-stat {
		display: flex;
		flex-direction: column;
	}

	.card-stat-value {
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.card-stat-label {
		font-size: 13px;
		color: var(--muted);
	}

	.card-highlights {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 16px;
	}

	.highlight-item {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		font-size: 15px;
	}

	.highlight-label {
		color: var(--muted);
	}

	.highlight-value {
		font-weight: 600;
		text-align: right;
	}

	.card-footer {
		font-size: 13px;
		color: var(--muted);
		overflow-wrap: anywhere;
	}

	.share-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
	}

	.share-btn svg {
		width: 18px;
		height: 18px;
	}
</style>
