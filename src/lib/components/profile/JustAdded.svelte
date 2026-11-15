<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';

	let { items, total, allHref }: {
		items: DiscogsCollectionItem[];
		/** The full count, for "See all <n> records". */
		total: number;
		/** The Records tab's address. */
		allHref: string;
	} = $props();

	function addedAt(item: DiscogsCollectionItem): number {
		const t = Date.parse(item.date_added);
		return Number.isNaN(t) ? 0 : t;
	}

	// The three latest by date added, picked here rather than trusting the order
	// handed in (a copy; the sort is stable, so ties keep the incoming order).
	let newest = $derived([...items].sort((a, b) => addedAt(b) - addedAt(a)).slice(0, 3));

	function timeAgo(dateString: string): string {
		const diffDays = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
		return `${Math.floor(diffDays / 365)}y ago`;
	}
</script>

<ul class="just-added">
	{#each newest as item (item.instance_id)}
		{@const artist = formatArtists(item.basic_information.artists)}
		<li>
			<a
				class="row"
				href="https://www.discogs.com/release/{item.basic_information.id}"
				target="_blank"
				rel="noopener noreferrer"
			>
				<img
					class="cover"
					src={item.basic_information.cover_image || item.basic_information.thumb || '/placeholder.svg'}
					alt=""
					loading="lazy"
					width="64"
					height="64"
				/>
				<span class="text">
					<span class="title">{item.basic_information.title}</span>
					<span class="artist">{artist}</span>
				</span>
				<time class="ago small" datetime={item.date_added}>{timeAgo(item.date_added)}</time>
			</a>
		</li>
	{/each}
</ul>

{#if total > 0}
	<a class="all" href={allHref}>See all {total.toLocaleString()} {total === 1 ? 'record' : 'records'}</a>
{/if}

<style>
	.just-added {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* A row under a hairline: the cover, then title over artist, and when it was added. */
	li {
		border-bottom: 1px solid var(--hairline);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 16px 0;
		color: var(--ink);
		text-decoration: none;
	}

	.row:hover .title {
		color: var(--accent);
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.cover {
		width: 64px;
		height: 64px;
		flex-shrink: 0;
		background: var(--track);
	}

	.text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.title {
		font-size: 21px;
		font-weight: 600;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.artist {
		font-size: 17px;
		color: var(--muted);
		overflow-wrap: anywhere;
	}

	.ago {
		flex-shrink: 0;
		white-space: nowrap;
	}

	.all {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch);
		margin-top: 8px;
		font-size: 17px;
		font-weight: 600;
	}
</style>
