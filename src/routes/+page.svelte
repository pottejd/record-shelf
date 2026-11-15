<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';
	import SkeletonProfile from '$lib/components/SkeletonProfile.svelte';

	let username = $state('');
	let isLoading = $state(false);
	let error = $state('');

	afterNavigate(() => {
		isLoading = false;
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		const trimmed = username.trim();
		if (!trimmed) {
			error = 'Please enter a username';
			return;
		}
		error = '';
		isLoading = true;
		goto(`/u/${encodeURIComponent(trimmed)}`);
	}

	const FEATURES = [
		{ title: 'Collection stats', text: 'Genre, decade, format breakdowns and more' },
		{ title: 'Top artists and labels', text: 'See who dominates the shelves' },
		{ title: 'Share the taste', text: 'Shareable link to show off any collection' }
	];
</script>

<svelte:head>
	<title>Record Shelf - Visualize Any Record Collection</title>
	<meta
		name="description"
		content="See beautiful stats and visualizations of any public Discogs collection"
	/>
	<meta property="og:title" content="Record Shelf" />
	<meta property="og:description" content="See beautiful stats and visualizations of any public Discogs collection" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Record Shelf" />
	<meta name="twitter:description" content="Visualize any Discogs record collection with beautiful charts and stats" />
</svelte:head>

{#if isLoading}
	<SkeletonProfile />
{:else}
<main id="main-content" class="home">
	<h1>Record Shelf</h1>
	<p class="lead">Discover insights from any public Discogs collection</p>

	<form class="search-form" onsubmit={handleSubmit}>
		<div class="input-group">
			<input
				type="text"
				class="field"
				bind:value={username}
				placeholder="Enter a Discogs username"
				aria-label="Discogs username"
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? 'username-error' : undefined}
				disabled={isLoading}
			/>
			<button type="submit" class="btn btn-primary" disabled={isLoading}>
				{#if isLoading}
					<span class="spinner"></span>
				{:else}
					Explore
				{/if}
			</button>
		</div>
		{#if error}
			<p id="username-error" class="error-note error-message">{error}</p>
		{/if}
	</form>

	<p class="hint small">
		Try an example:
		<button
			type="button"
			class="link-button"
			onclick={() => {
				username = 'recordmecca';
				handleSubmit(new Event('submit'));
			}}>recordmecca</button>
		<span class="separator">or</span>
		<button
			type="button"
			class="link-button"
			onclick={() => {
				username = 'djfunkygreg';
				handleSubmit(new Event('submit'));
			}}>djfunkygreg</button>
	</p>

	<!-- What the site shows, as open sections side by side (one column on a phone). -->
	<div class="features">
		{#each FEATURES as feature (feature.title)}
			<section class="section">
				<h2>{feature.title}</h2>
				<p class="muted">{feature.text}</p>
			</section>
		{/each}
	</div>
</main>
{/if}

<style>
	.home {
		padding-top: 56px;
		padding-bottom: var(--section-gap);
	}

	h1 {
		margin: 0;
	}

	.lead {
		margin-top: 16px;
		max-width: 44ch;
	}

	.search-form {
		max-width: 720px;
		margin-top: 40px;
	}

	.input-group {
		display: flex;
		align-items: flex-end;
		gap: 16px 24px;
	}

	.input-group .field {
		flex: 1;
		min-width: 0;
	}

	.input-group .btn {
		white-space: nowrap;
	}

	.error-message {
		margin-top: 16px;
	}

	.hint {
		margin: 20px 0 0;
	}

	.separator {
		margin: 0 0.25rem;
	}

	.link-button {
		min-height: var(--touch);
		padding: 0 2px;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 4px;
		cursor: pointer;
	}

	.link-button:hover {
		color: var(--accent);
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--section-gap) 64px;
		margin-top: 96px;
	}

	.features .section {
		margin-bottom: 0;
	}

	.features p {
		margin: 0;
	}

	@media (max-width: 699px) {
		.home {
			padding-top: 32px;
		}

		.input-group {
			flex-direction: column;
			align-items: stretch;
		}

		.features {
			grid-template-columns: 1fr;
			margin-top: 64px;
		}
	}
</style>
