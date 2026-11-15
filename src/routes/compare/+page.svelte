<script lang="ts">
	import { goto, afterNavigate } from '$app/navigation';

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
	<div class="compare-form">
		<h1>Head-to-Head</h1>
		<p class="lead description">Compare two Discogs collections to see overlap, unique finds, and taste similarity.</p>

		<div class="inputs">
			<div class="input-group">
				<label for="user1">First collector</label>
				<input
					id="user1"
					type="text"
					bind:value={username1}
					class="field"
					placeholder="Discogs username"
				/>
			</div>

			<div class="vs" aria-hidden="true">vs</div>

			<div class="input-group">
				<label for="user2">Second collector</label>
				<input
					id="user2"
					type="text"
					bind:value={username2}
					class="field"
					placeholder="Discogs username"
				/>
			</div>
		</div>

		{#if isSameUser || sameUserError}
			<p class="error-note error-message">Enter two different usernames to compare</p>
		{/if}

		<button class="btn btn-primary compare-btn" onclick={compare} disabled={!username1.trim() || !username2.trim() || isLoading || isSameUser}>
			{#if isLoading}
				<span class="spinner"></span>
				Comparing...
			{:else}
				Compare collections
			{/if}
		</button>
	</div>
</main>

<style>
	.compare-page {
		max-width: 720px;
		padding-top: 56px;
	}

	h1 {
		margin: 0;
	}

	.description {
		margin: 16px 0 40px;
	}

	.inputs {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: 32px;
	}

	.input-group label {
		display: block;
		font-size: 15px;
		color: var(--muted);
	}

	.vs {
		font-size: 21px;
		font-weight: 800;
		color: var(--muted);
	}

	.error-message {
		margin: 0 0 24px;
	}

	@media (max-width: 699px) {
		.compare-page {
			padding-top: 32px;
		}

		.compare-btn {
			width: 100%;
		}
	}
</style>
