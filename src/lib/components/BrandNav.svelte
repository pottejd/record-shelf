<script lang="ts">
	// Shared top-of-page brand nav: the record-disc logo linking home. Used on the
	// profile, compare, and comparison pages (previously copy-pasted into each).
</script>

<nav class="nav-bar">
	<a href="/" class="home-link">
		<svg aria-hidden="true" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="2"/>
			<circle cx="24" cy="24" r="12" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
			<circle cx="24" cy="24" r="3" fill="currentColor"/>
		</svg>
		<span>Record Shelf</span>
	</a>
</nav>

<style>
	.nav-bar {
		margin-bottom: 1.5rem;
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		color: var(--color-text);
		font-weight: 600;
		font-size: 1rem;
		padding: 0.5rem 0.75rem 0.5rem 0.5rem;
		margin: -0.5rem;
		border-radius: 8px;
		transition: background-color 0.15s;
	}

	.home-link:hover {
		background: var(--color-bg-secondary);
	}

	.home-link svg {
		width: 28px;
		height: 28px;
		color: var(--color-primary);
	}
</style>
