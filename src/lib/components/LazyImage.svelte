<script lang="ts">
	let { src, alt = '', ...rest }: { src: string; alt?: string; [key: string]: unknown } = $props();

	let loaded = $state(false);
	let error = $state(false);

	function onLoad() {
		loaded = true;
	}

	function onError() {
		error = true;
		loaded = true;
	}
</script>

<div class="lazy-image" class:loaded>
	{#if !error}
		<img
			{src}
			{alt}
			loading="lazy"
			onload={onLoad}
			onerror={onError}
			class:visible={loaded}
			{...rest}
		/>
	{/if}
	{#if !loaded}
		<div class="placeholder"></div>
	{/if}
</div>

<style>
	.lazy-image {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	img.visible {
		opacity: 1;
	}

	.placeholder {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg,
			var(--color-bg-secondary, #f0f0f0) 0%,
			var(--color-bg-tertiary, #e0e0e0) 50%,
			var(--color-bg-secondary, #f0f0f0) 100%
		);
		background-size: 200% 200%;
		animation: shimmer 1.5s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% { background-position: 100% 100%; }
		50% { background-position: 0% 0%; }
		100% { background-position: 100% 100%; }
	}
</style>
