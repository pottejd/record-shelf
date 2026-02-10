<script lang="ts">
	import { page } from '$app/stores';

	const errorInfo: Record<number, { icon: string; title: string; suggestion: string }> = {
		400: {
			icon: '?',
			title: 'Bad Request',
			suggestion: 'Check the URL and try again.'
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
	let message = $derived($page.error?.message || 'Something went wrong');
</script>

<svelte:head>
	<title>{info.title} - Record Shelf</title>
</svelte:head>

<main class="error-page">
	<div class="error-icon">{info.icon}</div>
	<h1>{status}</h1>
	<p class="title">{info.title}</p>
	<p class="message">{message}</p>
	<p class="suggestion">{info.suggestion}</p>
	<div class="actions">
		<a href="/" class="btn primary">Back to Home</a>
		{#if status === 429}
			<button class="btn secondary" onclick={() => location.reload()}>
				Retry
			</button>
		{/if}
		{#if status === 404}
			<a href="/compare" class="btn secondary">Compare Collections</a>
		{/if}
	</div>
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

	.error-icon {
		font-size: 3rem;
		margin-bottom: 0.5rem;
	}

	h1 {
		font-size: 5rem;
		margin: 0;
		line-height: 1;
		background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		font-weight: 800;
	}

	.title {
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0.5rem 0 0;
		color: var(--color-text);
	}

	.message {
		font-size: 1.125rem;
		color: var(--color-text-secondary, #666);
		margin: 0.75rem 0 0.5rem;
		max-width: 450px;
	}

	.suggestion {
		font-size: 0.9rem;
		color: var(--color-text-tertiary, #999);
		margin: 0 0 2rem;
		max-width: 400px;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border-radius: 10px;
		font-weight: 600;
		font-size: 0.9rem;
		text-decoration: none;
		cursor: pointer;
		border: none;
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.btn:hover {
		transform: translateY(-1px);
	}

	.btn.primary {
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: white;
	}

	.btn.primary:hover {
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
	}

	.btn.secondary {
		background: var(--color-bg-card, #f5f5f5);
		color: var(--color-text, #333);
		border: 1px solid var(--color-border, #e0e0e0);
	}

	.btn.secondary:hover {
		border-color: var(--color-primary, #6366f1);
		color: var(--color-primary, #6366f1);
	}
</style>
