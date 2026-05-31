import type { EnrichedMedia, NodeTypeValue, TreeItem } from "@repo/schemas";

// Music cover art comes from the Cover Art Archive in the search snapshot — the exact
// image tied to the release-group the user picked. Wikipedia/MusicBrainz song & album
// enrichment often resolves a *different* single/edition cover (and for songs with no
// page image, falls back to the artist's photo), so for music the snapshot must win.
// Every other type keeps enrichment-first: its snapshot is usually a small thumbnail
// (e.g. TMDB's w185 poster) that enrichment upgrades to a larger image.
const SNAPSHOT_IMAGE_PRIORITY_TYPES = new Set<NodeTypeValue>(["song", "album"]);

/**
 * Single source of truth for reconciling the snapshot image (what the user saw and
 * picked) against enrichment art, applied consistently across every display surface.
 * Mirrors the snapshot-first priority the entity resolver already uses, but flips to
 * enrichment-first for the types where enrichment art is the better/larger image.
 */
export function resolveDisplayImageUrl(
  item: TreeItem,
  media: EnrichedMedia | undefined,
): string | undefined {
  const snapshotImage = item.snapshot?.image;
  const enrichedImage = media?.coverUrl ?? media?.thumbnailUrl;
  return SNAPSHOT_IMAGE_PRIORITY_TYPES.has(item.type)
    ? (snapshotImage ?? enrichedImage)
    : (enrichedImage ?? snapshotImage);
}
