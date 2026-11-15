/**
 * What a record with no cover shows: an empty, see-through square. Every cover
 * stands on the track colour (the global `.cover` rule), so the tile takes the
 * chosen theme's track colour, light or dark, and the image keeps its alt text.
 */
export const NO_COVER = '/placeholder.svg';

/** For an image's `onerror`: a cover that fails to load gives way to the empty
 *  tile, so no broken-image mark shows. */
export function showNoCover(e: Event): void {
	const img = e.currentTarget as HTMLImageElement;
	if (!img.src.endsWith(NO_COVER)) img.src = NO_COVER;
}
