<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { localDayKey, parseLocalDayKey } from '$lib/utils/dates';
	import { shadeStep } from '$lib/utils/chart';

	/** `children` is the section heading, drawn on the line with the year's total. */
	let { items, children }: { items: DiscogsCollectionItem[]; children?: Snippet } = $props();

	interface DayData {
		date: string;
		count: number;
		step: number;
		/** "Sat, Nov 14, 2026: 2 records", or "…: no records". */
		label: string;
		/** False for the days of the first week before the year starts: they are not drawn. */
		inYear: boolean;
	}

	// One shared formatter reused for every cell label (vs. a new Intl format per
	// cell on every render).
	const dateFormatter = new Intl.DateTimeFormat('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	});

	let calendarData = $derived(generateCalendarData(items));
	let totalThisYear = $derived(calendarData.reduce((sum, d) => sum + d.count, 0));

	/**
	 * Every day from the Sunday on or before the year's first day to today, oldest
	 * first: day `i` sits in week `i / 7`, row `i % 7`. The year runs from the
	 * start of the same date a year ago; the days before it in that first week are
	 * kept for the arithmetic but not drawn, so every drawn day and the total
	 * count the same records.
	 */
	function generateCalendarData(items: DiscogsCollectionItem[]): DayData[] {
		const now = new Date();
		const yearStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

		// Count items per day
		const dayCounts = new Map<string, number>();
		for (const item of items) {
			const date = new Date(item.date_added);
			if (date >= yearStart && date <= now) {
				const key = localDayKey(date);
				dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
			}
		}

		const maxCount = Math.max(0, ...dayCounts.values());

		// Generate all days in the past year
		const days: DayData[] = [];
		const current = new Date(yearStart);

		// Start from the beginning of the week
		current.setDate(current.getDate() - current.getDay());

		while (current <= now) {
			const key = localDayKey(current);
			const count = dayCounts.get(key) || 0;
			const when = dateFormatter.format(parseLocalDayKey(key));
			days.push({
				date: key,
				count,
				step: shadeStep(count, maxCount),
				label: count > 0 ? `${when}: ${count} record${count !== 1 ? 's' : ''}` : `${when}: no records`,
				inYear: current >= yearStart
			});
			current.setDate(current.getDate() + 1);
		}

		return days;
	}

	let weekCount = $derived(Math.ceil(calendarData.length / 7));

	/** The first day drawn: the year's first day. */
	let firstIndex = $derived(Math.max(0, calendarData.findIndex((d) => d.inYear)));

	/** The grid's rows: one per weekday, Sunday first, each holding that day of every week drawn. */
	let weekRows = $derived(
		Array.from({ length: 7 }, (_, r) =>
			calendarData
				.map((day, i) => ({ day, week: Math.floor(i / 7) }))
				.filter(({ day }, i) => i % 7 === r && day.inYear)
		)
	);

	function getMonthLabels(days: DayData[]): { label: string; index: number }[] {
		const labels: { label: string; index: number }[] = [];
		let lastMonth = -1;

		days.forEach((day, i) => {
			const month = parseLocalDayKey(day.date).getMonth();
			if (month !== lastMonth && i % 7 === 0) {
				labels.push({
					label: parseLocalDayKey(day.date).toLocaleDateString('en-US', { month: 'short' }),
					index: Math.floor(i / 7)
				});
				lastMonth = month;
			}
		});

		return labels;
	}

	// The total for each month in the window, in text for screen readers.
	let monthTotals = $derived.by(() => {
		const totals = new Map<string, { label: string; count: number }>();
		for (const day of calendarData) {
			if (!day.inYear) continue;
			const date = parseLocalDayKey(day.date);
			const key = `${date.getFullYear()}-${date.getMonth()}`;
			const entry = totals.get(key) ?? {
				label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
				count: 0
			};
			entry.count += day.count;
			totals.set(key, entry);
		}
		return [...totals.values()];
	});

	let monthLabels = $derived(getMonthLabels(calendarData));

	// The calendar is one tab stop: the chosen day. Until one is chosen it is the
	// latest day with records (or today, when the year has none).
	let chosen = $state<string | null>(null);
	let activeIndex = $derived.by(() => {
		const at = chosen === null ? -1 : calendarData.findIndex((d) => d.date === chosen);
		if (at >= 0) return at;
		for (let i = calendarData.length - 1; i >= 0; i--) if (calendarData[i].count > 0) return i;
		return calendarData.length - 1;
	});

	let box = $state<HTMLDivElement | undefined>();

	// Open on the latest weeks when the year does not fit.
	$effect(() => {
		if (box) box.scrollLeft = box.scrollWidth;
	});

	/**
	 * Arrow keys move a day (up, down) or a week (left, right); Home and End go to
	 * the ends of the row, Ctrl+Home and Ctrl+End to the ends of the year. A move
	 * off the drawn days stays put; -1 is a key the calendar does not use.
	 */
	function target(i: number, e: KeyboardEvent): number {
		const last = calendarData.length - 1;
		const first = firstIndex;
		const row = i % 7;
		const within = (j: number) => (j >= first && j <= last ? j : i);
		switch (e.key) {
			case 'ArrowUp':
				return row > 0 ? within(i - 1) : i;
			case 'ArrowDown':
				return row < 6 ? within(i + 1) : i;
			case 'ArrowLeft':
				return within(i - 7);
			case 'ArrowRight':
				return within(i + 7);
			case 'Home':
				return e.ctrlKey ? first : row >= first ? row : row + 7;
			case 'End':
				return e.ctrlKey ? last : row + 7 * Math.floor((last - row) / 7);
			default:
				return -1;
		}
	}

	async function onKeydown(e: KeyboardEvent) {
		// Alt and Cmd with an arrow are the browser's Back and Forward: leave them be.
		if (e.altKey || e.metaKey) return;
		const next = target(activeIndex, e);
		if (next < 0) return;
		e.preventDefault();
		// The keys now lead: a label left by a resting pointer gives way to the focused day.
		hovered = null;
		chosen = calendarData[next].date;
		await tick();
		box?.querySelector<HTMLElement>(`[data-date="${chosen}"]`)?.focus();
	}

	// The label. A day with records shows it under the pointer; any day shows it
	// on keyboard focus, an empty one included. There is one label, drawn outside
	// the scroll box (which would clip it) and kept inside the part of the year
	// on screen.
	let hovered = $state<string | null>(null);
	/** Where the pointer last was, so a box scrolling under a still pointer does not count as a move. */
	let pointerAt = { x: NaN, y: NaN };

	function onPointerMove(e: PointerEvent, day: DayData) {
		if (e.clientX === pointerAt.x && e.clientY === pointerAt.y) return;
		pointerAt = { x: e.clientX, y: e.clientY };
		hovered = day.count > 0 ? day.date : null;
	}
	let focused = $state<string | null>(null);
	let shown = $derived.by(() => {
		const date = hovered ?? focused;
		return date === null ? null : (calendarData.find((d) => d.date === date) ?? null);
	});
	let body = $state<HTMLDivElement | undefined>();
	let tipEl = $state<HTMLSpanElement | undefined>();
	let tipAt = $state<{ left: number; top: number } | null>(null);

	function onFocusIn(e: FocusEvent, day: DayData) {
		chosen = day.date;
		let visible = true;
		try {
			visible = (e.currentTarget as HTMLElement).matches(':focus-visible');
		} catch {
			// A browser without :focus-visible shows the label on any focus.
		}
		focused = visible ? day.date : null;
	}

	/** Under the day for the top four rows, over it for the bottom three; never past the box's visible edges. */
	function placeTip() {
		if (!shown || !box || !body || !tipEl) return void (tipAt = null);
		const cell = box.querySelector<HTMLElement>(`[data-date="${shown.date}"]`);
		if (!cell) return void (tipAt = null);
		const c = cell.getBoundingClientRect();
		const b = box.getBoundingClientRect();
		const o = body.getBoundingClientRect();
		const w = tipEl.offsetWidth;
		const h = tipEl.offsetHeight;
		const row = calendarData.findIndex((d) => d.date === shown.date) % 7;
		const left = Math.min(Math.max(c.left, b.left), b.right - w) - o.left;
		const top = (row < 4 ? c.bottom + 6 : c.top - 6 - h) - o.top;
		tipAt = { left: Math.max(b.left - o.left, left), top };
	}

	$effect(() => {
		void shown;
		placeTip();
	});
</script>

<div class="collecting-calendar">
	<div class="calendar-header">
		{@render children?.()}
		<span class="year-total">{totalThisYear.toLocaleString()} records added in the past year</span>
	</div>

	<!-- One tab stop: the chosen day. Arrow keys move it, and the box scrolls to
	     follow when the year does not fit. -->
	<div class="calendar-body" bind:this={body}>
		<div
			class="calendar-scroll"
			role="grid"
			aria-label="Records added each day in the past year"
			tabindex="-1"
			bind:this={box}
			onkeydown={onKeydown}
			onscroll={placeTip}
		>
			<div class="calendar-inner">
				<div class="calendar-container" style:--weeks={weekCount}>
					<div class="day-labels" aria-hidden="true">
						<span></span>
						<span>Mon</span>
						<span></span>
						<span>Wed</span>
						<span></span>
						<span>Fri</span>
						<span></span>
					</div>

					<div class="calendar-grid">
						<div class="month-labels" aria-hidden="true">
							{#each monthLabels as { label, index }}
								<span style:grid-column={index + 1}>{label}</span>
							{/each}
						</div>

						<!-- Not "rows": the global .rows rule would draw hairlines between the weekdays. -->
						<div class="days">
							{#each weekRows as row}
								<div class="row" role="row">
									{#each row as { day, week } (day.date)}
										<div
											class="day step-{day.step}"
											style:grid-column={week + 1}
											class:shown={shown?.date === day.date}
											role="gridcell"
											aria-label={day.label}
											tabindex={calendarData[activeIndex]?.date === day.date ? 0 : -1}
											data-date={day.date}
											onfocus={(e) => onFocusIn(e, day)}
											onblur={() => (focused = null)}
											onpointermove={(e) => onPointerMove(e, day)}
											onpointerleave={() => (hovered = null)}
										></div>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				</div>

				<div class="calendar-legend" aria-hidden="true">
					<span>Fewer</span>
					<div class="legend-squares">
						{#each [1, 2, 3, 4, 5] as step}
							<div class="legend-cell step-{step}"></div>
						{/each}
					</div>
					<span>More</span>
				</div>
			</div>
		</div>

		{#if shown}
			<span
				class="day-tip"
				class:placed={tipAt !== null}
				bind:this={tipEl}
				style:left="{tipAt?.left ?? 0}px"
				style:top="{tipAt?.top ?? 0}px"
				aria-hidden="true"
			>{shown.label}</span>
		{/if}
	</div>

	<ul class="visually-hidden" aria-label="Records added each month in the past year">
		{#each monthTotals as month}
			<li>{month.label}: {month.count} record{month.count !== 1 ? 's' : ''}</li>
		{/each}
	</ul>
</div>

<style>
	/* A year of day cells, a column per week, shaded by count on the five-step
	   ramp, with the "Fewer … More" key under it. A day with nothing is an empty
	   cell with a hairline edge. A day with records shows its date and count in a
	   label on hover and on keyboard focus alike; an empty day shows its label on
	   keyboard focus only. */
	.calendar-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px 24px;
	}

	.calendar-header :global(h2) {
		margin: 0;
	}

	.year-total {
		font-size: 17px;
		color: var(--muted);
	}

	.calendar-body {
		position: relative;
		margin-top: 16px;
	}

	.calendar-scroll {
		overflow-x: auto;
	}

	.calendar-scroll:focus {
		outline: none;
	}

	.calendar-inner {
		min-width: 760px;
		/* Room for the focus outline of the cells along the edges. */
		padding: 0 5px 5px 0;
	}

	.calendar-container {
		display: flex;
		gap: 12px;
	}

	/* The labels' rows line up with the seven day rows beside them. */
	.day-labels {
		width: 44px;
		flex-shrink: 0;
		display: grid;
		grid-template-rows: repeat(7, minmax(0, 1fr));
		gap: 2px;
		align-items: center;
		padding-top: 28px;
		font-size: 13px;
		line-height: 1;
		color: var(--muted);
	}

	.calendar-grid {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.month-labels,
	.row {
		display: grid;
		grid-template-columns: repeat(var(--weeks), minmax(0, 1fr));
		gap: 2px;
	}

	.month-labels {
		height: 20px;
		font-size: 15px;
		line-height: 20px;
		color: var(--muted);
	}

	.month-labels span {
		white-space: nowrap;
	}

	.days {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.day {
		position: relative;
		aspect-ratio: 1;
	}

	.day.step-0 {
		box-shadow: inset 0 0 0 1px var(--hairline);
	}

	.day:focus-visible {
		outline-offset: 1px;
	}

	.step-1 { background: var(--shade-1); }
	.step-2 { background: var(--shade-2); }
	.step-3 { background: var(--shade-3); }
	.step-4 { background: var(--shade-4); }
	.step-5 { background: var(--shade-5); }

	/* The label: ink with ground-coloured text, placed by placeTip() over the
	   box rather than inside it, so the scroll box cannot cut it. Hidden until
	   placed, so it never shows in the wrong spot for a frame. */
	.day-tip {
		position: absolute;
		z-index: 2;
		padding: 6px 10px;
		background: var(--ink);
		color: var(--on-ink);
		font-size: 15px;
		line-height: 1.3;
		white-space: nowrap;
		pointer-events: none;
		visibility: hidden;
	}

	.day-tip.placed {
		visibility: visible;
	}

	.day.shown,
	.day:hover,
	.day:focus-visible {
		z-index: 1;
	}

	.calendar-legend {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		margin-top: 16px;
		font-size: 15px;
		color: var(--muted);
	}

	.legend-squares {
		display: flex;
		gap: 6px;
		margin: 0 4px;
	}

	.legend-cell {
		width: 16px;
		height: 16px;
	}
</style>
