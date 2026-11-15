/** The profile's five tabs, in the order the tab row shows them. */
export const TABS = ['overview', 'records', 'charts', 'activity', 'extras'] as const;
export type TabId = (typeof TABS)[number];

export const TAB_LABELS: Record<TabId, string> = {
	overview: 'Overview',
	records: 'Records',
	charts: 'Charts',
	activity: 'Activity',
	extras: 'Extras'
};

/** The Records filters' address parameters, in the order they are written. */
export const RECORDS_PARAMS = ['search', 'genre', 'format', 'decade', 'sort', 'order', 'page'] as const;

function isTab(value: string | null): value is TabId {
	return value !== null && (TABS as readonly string[]).includes(value);
}

/**
 * The open tab. An unknown `tab` shows Overview; an address with no `tab` but a
 * Records filter (a link from before the tabs) opens Records.
 */
export function tabFromUrl(url: URL): TabId {
	const params = url.searchParams;
	if (params.has('tab')) {
		const tab = params.get('tab');
		return isTab(tab) ? tab : 'overview';
	}
	return RECORDS_PARAMS.some((p) => params.has(p)) ? 'records' : 'overview';
}

/** The address of a tab: the page's path, plus `?tab=<id>` unless Overview. Every other parameter is dropped. */
export function tabHref(url: URL, tab: TabId): string {
	return tab === 'overview' ? url.pathname : `${url.pathname}?tab=${tab}`;
}

/** The next (1) or previous (-1) tab; stays put at either end. */
export function stepTab(tab: TabId, dir: 1 | -1): TabId {
	const i = TABS.indexOf(tab) + dir;
	return TABS[Math.min(Math.max(i, 0), TABS.length - 1)];
}

export interface RecordsQuery {
	search: string;
	genre: string;
	format: string;
	decade: string;
	sort: 'added' | 'artist' | 'title' | 'year';
	order: 'asc' | 'desc';
	page: number;
}

/** The Records address for these filters: `?tab=records` plus every filter that is not at its default. */
export function recordsHref(url: URL, q: RecordsQuery): string {
	const params = new URLSearchParams({ tab: 'records' });
	if (q.search) params.set('search', q.search);
	if (q.genre) params.set('genre', q.genre);
	if (q.format) params.set('format', q.format);
	if (q.decade) params.set('decade', q.decade);
	if (q.sort !== 'added') params.set('sort', q.sort);
	if (q.order !== 'desc') params.set('order', q.order);
	if (q.page > 1) params.set('page', String(q.page));
	return `${url.pathname}?${params}`;
}
