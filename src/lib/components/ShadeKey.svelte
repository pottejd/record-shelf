<!-- The "Fewer … More" key under a shaded grid: the five steps of the ramp. The
     step colours are the global .step-N classes in app.css. -->
<div class="shade-key" aria-hidden="true">
	<span>Fewer</span>
	<div class="shade-steps">
		{#each [1, 2, 3, 4, 5] as step}
			<div class="shade-cell step-{step}"></div>
		{/each}
	</div>
	<span>More</span>
</div>

<style>
	.shade-key {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		margin-top: 16px;
		font-size: 15px;
		color: var(--muted);
	}

	.shade-steps {
		display: flex;
		gap: 6px;
		margin: 0 4px;
	}

	.shade-cell {
		width: 16px;
		height: 16px;
	}
</style>
