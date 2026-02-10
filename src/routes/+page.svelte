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
	<title>Record Shelf - Visualize Your Record Collection</title>
	<meta
		name="description"
		content="See beautiful stats and visualizations of any public Discogs collection"
	/>
	<meta property="og:title" content="Record Shelf" />
	<meta property="og:description" content="See beautiful stats and visualizations of any public Discogs collection" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="Record Shelf" />
	<meta name="twitter:description" content="Visualize your Discogs record collection with beautiful charts and stats" />
</svelte:head>

{#if isLoading}
	<SkeletonProfile />
{:else}
<main class="home">
	<a href="/settings" class="settings-link" aria-label="Settings">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
		</svg>
	</a>
	<div class="bg-gradient"></div>

	<div class="hero">
		<div class="logo">
			<span class="logo-icon">
				<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2.5"/>
					<circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
					<circle cx="24" cy="24" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
					<circle cx="24" cy="24" r="4" fill="currentColor"/>
				</svg>
			</span>
		</div>
		<h1>Record Shelf</h1>
		<p class="tagline">Discover insights from any public Discogs collection</p>

		<form class="search-form" onsubmit={handleSubmit}>
			<div class="input-group">
				<input
					type="text"
					bind:value={username}
					placeholder="Enter a Discogs username"
					disabled={isLoading}
					class:error={!!error}
				/>
				<button type="submit" disabled={isLoading}>
					{#if isLoading}
						<span class="spinner"></span>
					{:else}
						Explore
					{/if}
				</button>
			</div>
			{#if error}
				<p class="error-message">{error}</p>
			{/if}
		</form>

		<p class="hint">
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

		<a href="/compare" class="compare-link">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
			</svg>
			Compare Two Collections
		</a>
	</div>

	<section class="features">
		<div class="feature">
			<div class="feature-icon" style="--accent: #6366f1;">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 20V10M12 20V4M6 20v-6"/>
				</svg>
			</div>
			<h3>Collection Stats</h3>
			<p>Genre, decade, format breakdowns and more</p>
		</div>
		<div class="feature">
			<div class="feature-icon" style="--accent: #ec4899;">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
				</svg>
			</div>
			<h3>Top Artists & Labels</h3>
			<p>See who dominates your shelves</p>
		</div>
		<div class="feature">
			<div class="feature-icon" style="--accent: #f97316;">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
				</svg>
			</div>
			<h3>Share Your Taste</h3>
			<p>Shareable link to show off your collection</p>
		</div>
	</section>

	<footer class="footer">
		<p>&copy; {new Date().getFullYear()} Record Shelf. Not affiliated with Discogs.</p>
	</footer>
</main>
{/if}

<style>
	.home {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		position: relative;
		overflow: hidden;
	}

	.settings-link {
		position: absolute;
		top: 1.5rem;
		right: 1.5rem;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-tertiary);
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		z-index: 10;
		transition: color 0.2s, background-color 0.2s, border-color 0.2s;
	}

	.settings-link:hover {
		color: var(--color-primary);
		background: var(--color-bg-secondary);
		border-color: var(--color-primary);
	}

	.settings-link svg {
		width: 20px;
		height: 20px;
	}

	.bg-gradient {
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
					radial-gradient(circle at 70% 60%, rgba(236, 72, 153, 0.06) 0%, transparent 50%),
					radial-gradient(circle at 40% 80%, rgba(249, 115, 22, 0.05) 0%, transparent 50%);
		pointer-events: none;
		z-index: 0;
	}

	.hero {
		text-align: center;
		max-width: 560px;
		margin-top: 12vh;
		position: relative;
		z-index: 1;
	}

	.logo {
		margin-bottom: 1.5rem;
	}

	.logo-icon {
		display: inline-flex;
		width: 64px;
		height: 64px;
		color: var(--color-primary);
	}

	.logo-icon svg {
		width: 100%;
		height: 100%;
	}

	h1 {
		font-size: 3.5rem;
		margin: 0 0 0.5rem;
		font-weight: 800;
		background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: -0.02em;
	}

	.tagline {
		font-size: 1.25rem;
		color: var(--color-text-secondary);
		margin: 0 0 2.5rem;
	}

	.search-form {
		width: 100%;
	}

	.input-group {
		display: flex;
		gap: 0.75rem;
		width: 100%;
		background: var(--color-bg-card);
		padding: 0.5rem;
		border-radius: 16px;
		box-shadow: var(--shadow-lg), 0 0 0 1px var(--color-border);
	}

	input {
		flex: 1;
		padding: 1rem 1.25rem;
		font-size: 1rem;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--color-text);
		transition: background-color 0.2s;
	}

	input:focus {
		outline: none;
		background: var(--color-bg-secondary);
	}

	input::placeholder {
		color: var(--color-text-tertiary);
	}

	input.error {
		background: rgba(239, 68, 68, 0.1);
	}

	button[type='submit'] {
		padding: 1rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: white;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
		white-space: nowrap;
	}

	button[type='submit']:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
	}

	button[type='submit']:active:not(:disabled) {
		transform: translateY(0);
	}

	button[type='submit']:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.spinner {
		display: inline-block;
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.error-message {
		color: #ef4444;
		font-size: 0.875rem;
		margin: 0.75rem 0 0;
		text-align: left;
		padding-left: 0.5rem;
	}

	.hint {
		margin-top: 1.25rem;
		font-size: 0.875rem;
		color: var(--color-text-tertiary);
	}

	.separator {
		margin: 0 0.25rem;
	}

	.link-button {
		background: none;
		border: none;
		color: var(--color-primary);
		text-decoration: none;
		cursor: pointer;
		font-size: inherit;
		font-weight: 500;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		transition: background-color 0.15s;
	}

	.link-button:hover {
		background: rgba(99, 102, 241, 0.1);
	}

	.compare-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 2rem;
		padding: 0.75rem 1.25rem;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		color: var(--color-text-secondary);
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		transition: border-color 0.2s, color 0.2s;
	}

	.compare-link:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.compare-link svg {
		width: 18px;
		height: 18px;
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1.5rem;
		margin-top: 8rem;
		max-width: 800px;
		width: 100%;
		position: relative;
		z-index: 1;
	}

	.feature {
		text-align: center;
		padding: 2rem 1.5rem;
		background: var(--color-bg-card);
		border-radius: 16px;
		border: 1px solid var(--color-border);
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.feature:hover {
		transform: translateY(-4px);
		box-shadow: var(--shadow-lg);
	}

	.feature-icon {
		width: 48px;
		height: 48px;
		margin: 0 auto 1rem;
		padding: 12px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--accent) 15%, transparent);
		color: var(--accent);
	}

	.feature-icon svg {
		width: 100%;
		height: 100%;
	}

	.feature h3 {
		margin: 0 0 0.5rem;
		font-size: 1.0625rem;
		font-weight: 600;
	}

	.feature p {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.footer {
		margin-top: auto;
		padding-top: 4rem;
		position: relative;
		z-index: 1;
	}

	.footer p {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
		text-align: center;
	}

	@media (max-width: 600px) {
		h1 {
			font-size: 2.5rem;
		}

		.tagline {
			font-size: 1rem;
		}

		.input-group {
			flex-direction: column;
			padding: 0.75rem;
		}

		button[type='submit'] {
			width: 100%;
		}

		.hero {
			margin-top: 8vh;
		}

		.features {
			margin-top: 4rem;
		}
	}
</style>
