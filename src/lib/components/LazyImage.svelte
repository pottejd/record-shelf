<script lang="ts">
	let { src, alt = '', ...rest }: { src: string; alt?: string; [key: string]: unknown } = $props();

	let loaded = $state(false);
	let error = $state(false);
	let shouldLoad = $state(false);
	let container = $state<HTMLDivElement | undefined>();

	// Defer creating the <img> until it scrolls near the viewport, so off-screen
	// covers (e.g. a long wantlist) don't all request at once. rootMargin loads
	// a little ahead so there's no visible pop-in.
	$effect(() => {
		if (typeof IntersectionObserver === 'undefined') {
			shouldLoad = true;
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					shouldLoad = true;
					observer.disconnect();
				}
			},
			{ rootMargin: '200px' }
		);
		if (container) observer.observe(container);
		return () => observer.disconnect();
	});

	// Reset load state when src changes — the instance may be reused for a new
	// item in an unkeyed list, where stale loaded/error would flash the old cover
	// (or leave a permanently-blank slot if the previous src had failed).
	$effect(() => {
		src; // track
		loaded = false;
		error = false;
	});

	function onLoad() {
		loaded = true;
	}

	function onError() {
		error = true;
		loaded = true;
	}
</script>

<div class="lazy-image" class:loaded bind:this={container}>
	{#if shouldLoad && !error}
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
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
	}

	img.visible {
		opacity: 1;
	}

	/* A flat placeholder in the track colour until the cover arrives. */
	.placeholder {
		position: absolute;
		inset: 0;
		background: var(--track);
	}
</style>
