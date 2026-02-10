// Core Discogs API types

export interface DiscogsArtist {
	id: number;
	name: string;
	resource_url: string;
	anv?: string; // Artist name variation
	join?: string;
	role?: string;
	tracks?: string;
}

export interface DiscogsLabel {
	id: number;
	name: string;
	catno: string;
	resource_url: string;
	entity_type?: string;
}

export interface DiscogsFormat {
	name: string;
	qty: string;
	descriptions?: string[];
	text?: string;
}

export interface DiscogsImage {
	type: string;
	uri: string;
	uri150: string;
	width: number;
	height: number;
}

export interface DiscogsBasicInformation {
	id: number;
	master_id?: number;
	master_url?: string;
	title: string;
	year: number;
	thumb: string;
	cover_image?: string;
	resource_url: string;
	artists: DiscogsArtist[];
	labels: DiscogsLabel[];
	formats: DiscogsFormat[];
	genres: string[];
	styles: string[];
}

export interface DiscogsCollectionItem {
	id: number;
	instance_id: number;
	folder_id: number;
	rating: number;
	basic_information: DiscogsBasicInformation;
	date_added: string;
}

export interface DiscogsPagination {
	page: number;
	pages: number;
	per_page: number;
	items: number;
	urls: {
		first?: string;
		last?: string;
		prev?: string;
		next?: string;
	};
}

export interface DiscogsCollectionResponse {
	pagination: DiscogsPagination;
	releases: DiscogsCollectionItem[];
}

export interface DiscogsUserProfile {
	id: number;
	username: string;
	name: string;
	avatar_url: string;
	resource_url: string;
	inventory_url: string;
	collection_folders_url: string;
	collection_fields_url: string;
	wantlist_url: string;
	num_collection: number;
	num_wantlist: number;
	num_pending: number;
	num_for_sale: number;
	num_lists: number;
	location: string;
	profile: string;
	registered: string;
	releases_contributed: number;
	releases_rated: number;
	rating_avg: number;
}

// Processed/aggregated types for our app

export interface CollectionStats {
	totalItems: number;
	totalArtists: number;
	totalLabels: number;
	formatBreakdown: Record<string, number>;
	formatDetailBreakdown: Record<string, number>;
	genreBreakdown: Record<string, number>;
	styleBreakdown: Record<string, number>;
	decadeBreakdown: Record<string, number>;
	yearBreakdown: Record<number, number>;
	topArtists: Array<{ name: string; count: number }>;
	topLabels: Array<{ name: string; count: number }>;
	topStyles: Array<{ name: string; count: number }>;
	recentlyAdded: DiscogsCollectionItem[];
	addedByMonth: Array<{ date: string; count: number }>;
	oldestRelease: DiscogsBasicInformation | null;
	newestRelease: DiscogsBasicInformation | null;
	averageYear: number;
	medianYear: number;
	uniqueArtistRatio: number;
	collectionSpan: number;
	dominantDecade: string;
	dominantGenre: string;
	ratingBreakdown: Record<number, number>;
	averageRating: number;
	ratedCount: number;
	topRatedItems: DiscogsCollectionItem[];
}

export interface UserCollection {
	profile: DiscogsUserProfile;
	items: DiscogsCollectionItem[];
	stats: CollectionStats;
	fetchedAt: number;
}

export interface CachedCollection {
	data: UserCollection;
	cachedAt: number;
	expiresAt: number;
}
