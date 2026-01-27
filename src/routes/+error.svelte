<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>Error - Record Shelf</title>
</svelte:head>

<main class="error-page">
	<h1>{$page.status}</h1>
	<p class="message">{$page.error?.message || 'Something went wrong'}</p>
	<a href="/" class="back-link">Back to home</a>
</main>

<style>
	.error-page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
	}

	h1 {
		font-size: 6rem;
		margin: 0;
		line-height: 1;
		opacity: 0.2;
	}

	.message {
		font-size: 1.25rem;
		color: var(--color-text-secondary, #666);
		margin: 1rem 0 2rem;
		max-width: 400px;
	}

	.back-link {
		padding: 0.75rem 1.5rem;
		background: var(--color-primary, #333);
		color: white;
		text-decoration: none;
		border-radius: 8px;
		font-weight: 600;
		transition: background-color 0.2s;
	}

	.back-link:hover {
		background: var(--color-primary-hover, #555);
	}
</style>
