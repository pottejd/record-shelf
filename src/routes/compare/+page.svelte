<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';
	import BrandNav from '$lib/components/BrandNav.svelte';

	let username1 = $state('');
	let username2 = $state('');
	let isLoading = $state(false);
	let sameUserError = $state(false);

	afterNavigate(() => {
		isLoading = false;
	});

	let isSameUser = $derived(
		username1.trim() !== '' &&
		username2.trim() !== '' &&
		username1.trim().toLowerCase() === username2.trim().toLowerCase()
	);

	function compare() {
		const u1 = username1.trim();
		const u2 = username2.trim();
		if (!u1 || !u2 || isLoading) return;
		if (u1.toLowerCase() === u2.toLowerCase()) {
			sameUserError = true;
			return;
		}
		sameUserError = false;
		isLoading = true;
		goto(`/compare/${encodeURIComponent(u1)}/${encodeURIComponent(u2)}`);
	}
</script>

<svelte:head>
	<title>Compare Collections - Record Shelf</title>
</svelte:head>

<main id="main-content" class="compare-page">
	<BrandNav />

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

		{#if isSameUser || sameUserError}
			<p class="error-message">Enter two different usernames to compare</p>
		{/if}

		<button class="compare-btn" onclick={compare} disabled={!username1.trim() || !username2.trim() || isLoading || isSameUser}>
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
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
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
		background: var(--gradient-brand);
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

	.error-message {
		color: #ef4444;
		font-size: 0.875rem;
		margin: 0 0 1rem;
	}

	/* Base .spinner is global (app.css); only spacing differs here. */
	.spinner {
		vertical-align: middle;
		margin-right: 0.5rem;
	}
</style>
