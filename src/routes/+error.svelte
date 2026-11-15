<script lang="ts">
	import { page } from '$app/stores';

	const errorInfo: Record<number, { icon: string; title: string; suggestion: string }> = {
		400: {
			icon: '?',
			title: 'Bad Request',
			suggestion: 'Check the URL and try again.'
		},
		401: {
			icon: '\u{1F511}',
			title: 'Token Required',
			suggestion: 'Your Discogs token may be missing or invalid. Add or update it in Settings.'
		},
		403: {
			icon: '\u{1F512}',
			title: 'Private Collection',
			suggestion: 'This collection is private. The owner would need to make it public on Discogs.'
		},
		404: {
			icon: '\u{1F50D}',
			title: 'Not Found',
			suggestion: 'Double-check the username and try again.'
		},
		429: {
			icon: '\u{23F3}',
			title: 'Too Many Requests',
			suggestion: 'Discogs rate limit reached. Wait a minute and try again.'
		},
		500: {
			icon: '\u{26A0}\u{FE0F}',
			title: 'Server Error',
			suggestion: 'Something went wrong on our end. Please try again later.'
		}
	};

	let status = $derived($page.status);
	let info = $derived(errorInfo[status] || errorInfo[500]);
	let rawMessage = $derived($page.error?.message || 'Something went wrong');
	let message = $derived(rawMessage === info.title ? '' : rawMessage);
</script>

<svelte:head>
	<title>{info.title} - Record Shelf</title>
</svelte:head>

<main id="main-content" class="error-page">
	<div class="error-icon">{info.icon}</div>
	<h1>{status}</h1>
	<p class="title">{info.title}</p>
	{#if message}
		<p class="message">{message}</p>
	{/if}
	<p class="suggestion muted">{info.suggestion}</p>
	<div class="actions">
		<a href="/" class="btn btn-primary">Back to Home</a>
		{#if status === 401}
			<a href="/settings" class="btn btn-secondary">Go to Settings</a>
		{/if}
		{#if status === 429}
			<button class="btn btn-secondary" onclick={() => location.reload()}>
				Retry
			</button>
		{/if}
		{#if status === 404}
			<a href="/compare" class="btn btn-secondary">Compare Collections</a>
		{/if}
	</div>
</main>

<style>
	.error-page {
		padding-top: 56px;
	}

	.error-icon {
		font-size: 40px;
		line-height: 1;
		margin-bottom: 16px;
	}

	h1 {
		margin: 0;
	}

	.title {
		margin: 16px 0 0;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.message {
		margin: 12px 0 0;
		max-width: 560px;
		font-size: 18px;
	}

	.suggestion {
		margin: 12px 0 32px;
		max-width: 560px;
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
	}
</style>
