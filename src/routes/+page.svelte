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
	<div class="hero">
		<h1>Record Shelf</h1>
		<p class="lead tagline">Discover insights from any public Discogs collection</p>

		<form class="search-form" onsubmit={handleSubmit}>
			<div class="input-group">
				<input
					type="text"
					class="field"
					bind:value={username}
					placeholder="Enter a Discogs username"
					aria-label="Discogs username"
					aria-invalid={error ? 'true' : undefined}
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
				<p class="error-note error-message">{error}</p>
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
	</div>

	<section class="features">
		<div class="feature">
			<svg class="feature-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 20V10M12 20V4M6 20v-6"/>
			</svg>
			<h3>Collection Stats</h3>
			<p>Genre, decade, format breakdowns and more</p>
		</div>
		<div class="feature">
			<svg class="feature-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
			</svg>
			<h3>Top Artists & Labels</h3>
			<p>See who dominates the shelves</p>
		</div>
		<div class="feature">
			<svg class="feature-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
			</svg>
			<h3>Share the Taste</h3>
			<p>Shareable link to show off any collection</p>
		</div>
	</section>
</main>
{/if}

<style>
	.home {
		padding-top: 56px;
	}

	.hero {
		max-width: 720px;
	}

	h1 {
		margin: 0;
	}

	.tagline {
		margin-top: 16px;
	}

	.search-form {
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
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 40px 48px;
		margin-top: 96px;
	}

	.feature {
		border-top: var(--rule) solid var(--ink);
		padding-top: 16px;
	}

	.feature-icon {
		display: block;
		width: 28px;
		height: 28px;
		margin-bottom: 16px;
		color: var(--ink);
	}

	.feature h3 {
		margin: 0 0 6px;
		font-size: 21px;
		font-weight: 700;
	}

	.feature p {
		margin: 0;
		color: var(--muted);
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
			margin-top: 64px;
		}
	}
</style>
