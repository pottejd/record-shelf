<script lang="ts">
	import { page } from '$app/stores';

	const errorInfo: Record<number, { title: string; suggestion: string }> = {
		400: {
			title: 'Bad request',
			suggestion: 'Check the URL and try again.'
		},
		401: {
			title: 'Token required',
			suggestion: 'Your Discogs token may be missing or invalid. Add or update it in Settings.'
		},
		403: {
			title: 'Private collection',
			suggestion: 'This collection is private. The owner would need to make it public on Discogs.'
		},
		404: {
			title: 'Not found',
			suggestion: 'Double-check the username and try again.'
		},
		429: {
			title: 'Too many requests',
			suggestion: 'Discogs rate limit reached. Wait a minute and try again.'
		},
		500: {
			title: 'Server error',
			suggestion: 'Something went wrong on our end. Please try again later.'
		}
	};

	let status = $derived($page.status);
	let info = $derived(errorInfo[status] || errorInfo[500]);
	let rawMessage = $derived($page.error?.message || 'Something went wrong');
	// SvelteKit's own messages repeat the title ("Not Found"): say it once.
	let message = $derived(rawMessage.toLowerCase() === info.title.toLowerCase() ? '' : rawMessage);
</script>

<svelte:head>
	<title>{info.title} - Record Shelf</title>
</svelte:head>

<main id="main-content" class="error-page">
	<p class="status small">Error {status}</p>
	<h1>{info.title}</h1>
	<section class="section">
		{#if message}
			<p class="message">{message}</p>
		{/if}
		<p class="suggestion muted">{info.suggestion}</p>
		<div class="actions">
			<a href="/" class="btn btn-primary">Back to home</a>
			{#if status === 401}
				<a href="/settings" class="btn btn-secondary">Go to Settings</a>
			{/if}
			{#if status === 429}
				<button class="btn btn-secondary" onclick={() => location.reload()}>
					Retry
				</button>
			{/if}
			{#if status === 404}
				<a href="/compare" class="btn btn-secondary">Compare collections</a>
			{/if}
		</div>
	</section>
</main>

<style>
	.error-page {
		padding-top: 56px;
	}

	.status {
		margin: 0 0 12px;
	}

	h1 {
		margin: 0 0 48px;
		overflow-wrap: anywhere;
	}

	.message {
		margin: 0 0 8px;
		max-width: 560px;
		font-size: 18px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.suggestion {
		margin: 0 0 32px;
		max-width: 560px;
		font-size: 18px;
	}

	.actions {
		display: flex;
		gap: 12px 16px;
		flex-wrap: wrap;
	}

	@media (max-width: 699px) {
		.error-page {
			padding-top: 32px;
		}

		h1 {
			margin-bottom: 32px;
		}
	}
</style>
