export interface BarLink {
	label: string;
	href: string;
	external?: boolean;
}

const PROFILE = '/u/[username=username]';
const WANTLIST = '/u/[username=username]/wantlist';

const SETTINGS: BarLink = { label: 'Settings', href: '/settings' };

/** The links on the right of the top bar for a route. */
export function barLinks(routeId: string | null, params: Record<string, string>): BarLink[] {
	const user = encodeURIComponent(params.username ?? '');
	if (routeId === PROFILE) {
		return [
			{ label: 'Wantlist', href: `/u/${user}/wantlist` },
			{ label: 'Discogs', href: `https://www.discogs.com/user/${user}`, external: true },
			SETTINGS
		];
	}
	if (routeId === WANTLIST) {
		return [{ label: 'Collection', href: `/u/${user}` }, SETTINGS];
	}
	return [{ label: 'Compare', href: '/compare' }, SETTINGS];
}

/** Only the profile has a refresh button in the bar. */
export function hasRefresh(routeId: string | null): boolean {
	return routeId === PROFILE;
}
