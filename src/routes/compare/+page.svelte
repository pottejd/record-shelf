<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';

	let username1 = $state('');
	let username2 = $state('');
	let isLoading = $state(false);

	afterNavigate(() => {
		isLoading = false;
	});

	function compare() {
		if (username1.trim() && username2.trim() && !isLoading) {
			isLoading = true;
			goto(`/compare/${encodeURIComponent(username1.trim())}/${encodeURIComponent(username2.trim())}`);
		}
	}
</script>

<svelte:head>
	<title>Compare Collections - Record Shelf</title>
</svelte:head>

<main class="compare-page">
	<nav class="nav-bar">
		<a href="/" class="home-link">
			<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
				<circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/>
				<circle cx="24" cy="24" r="12" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
				<circle cx="24" cy="24" r="3" fill="currentColor"/>
			</svg>
			<span>Record Shelf</span>
		</a>
	</nav>

	<div class="compare-form">
		<h1>Head-to-Head</h1>
		<p class="description">Compare two Discogs collections to see overlap, unique finds, and taste similarity.</p>

		<div class="inputs">
			<div class="input-group">
				<label for="user1">First collector</label>
				<input
					id="user1"
					type="text"
					bind:value={username1}
					placeholder="Discogs username"
				/>
			</div>

			<div class="vs">VS</div>

			<div class="input-group">
				<label for="user2">Second collector</label>
				<input
					id="user2"
					type="text"
					bind:value={username2}
					placeholder="Discogs username"
				/>
			</div>
		</div>

		<button class="compare-btn" onclick={compare} disabled={!username1.trim() || !username2.trim() || isLoading}>
			{#if isLoading}
				<span class="spinner"></span>
				Comparing...
			{:else}
				Compare Collections
			{/if}
		</button>
	</div>
</main>

<style>
	.compare-page {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem;
	}

	.nav-bar {
		margin-bottom: 3rem;
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--color-text);
		font-weight: 600;
		font-size: 1rem;
	}

	.home-link svg {
		width: 28px;
		height: 28px;
		color: var(--color-primary);
	}

	.compare-form {
		text-align: center;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: 2rem;
		background: linear-gradient(135deg, #6366f1, #ec4899);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.description {
		margin: 0 0 2rem;
		color: var(--color-text-secondary);
	}

	.inputs {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.input-group {
		width: 100%;
	}

	.input-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.input-group input {
		width: 100%;
		padding: 0.875rem 1rem;
		font-size: 1rem;
		border: 2px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-bg-card);
		color: var(--color-text);
		text-align: center;
	}

	.input-group input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.vs {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--color-text-tertiary);
		padding: 0.5rem 0;
	}

	.compare-btn {
		padding: 1rem 2.5rem;
		font-size: 1rem;
		font-weight: 600;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: white;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
	}

	.compare-btn:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
	}

	.compare-btn:disabled {
		opacity: 0.5;
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
		vertical-align: middle;
		margin-right: 0.5rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
