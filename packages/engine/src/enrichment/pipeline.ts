import type { CultureTree, EnrichedMedia, NodeTypeValue, TreeItem } from "@repo/schemas";

import { fetchBookEnrichment } from "./books";
import { getCachedEnrichment, setCachedEnrichment } from "./cache";
import { fetchFilmEnrichment, fetchTvEnrichment } from "./films";
import { fetchMusicBrainzAlbumEnrichment } from "./musicbrainz";
import {
  fetchWikipediaArtworkEnrichment,
  fetchWikipediaEnrichment,
  fetchWikipediaEventEnrichment,
  fetchWikipediaPlaceEnrichment,
  fetchWikipediaSongEnrichment,
} from "./wikipedia";

type Enricher = (item: TreeItem) => Promise<EnrichedMedia>;

function hasEnrichmentData(media: EnrichedMedia): boolean {
  return Object.keys(media).length > 0;
}

/** Books cached before Wikipedia cover fallback (or bad GB hits) can have links but no art — re-run enricher. */
function bookNeedsCoverRetry(cached: EnrichedMedia): boolean {
  const noArt = !cached.coverUrl?.trim() && !cached.thumbnailUrl?.trim();
  return noArt && Boolean(cached.externalUrl?.trim() || cached.description?.trim());
}

/** Wikipedia-backed row with text/URL but no lead image yet — re-fetch in case a better image is now available. */
function wikiBackedButMissingImage(cached: EnrichedMedia): boolean {
  const noArt = !cached.coverUrl?.trim() && !cached.thumbnailUrl?.trim();
  return noArt && Boolean(cached.wikipediaUrl?.trim() || cached.wikiExtract?.trim());
}

const WIKI_IMAGE_RETRY_TYPES = new Set<NodeTypeValue>(["artwork", "song", "place", "event"]);

const enricherRegistry: Partial<Record<NodeTypeValue, Enricher>> = {
  book: fetchBookEnrichment,
  film: fetchFilmEnrichment,
  tv: fetchTvEnrichment,
  album: fetchMusicBrainzAlbumEnrichment,
  song: fetchWikipediaSongEnrichment,
  person: fetchWikipediaEnrichment,
  artist: fetchWikipediaEnrichment,
  artwork: fetchWikipediaArtworkEnrichment,
  place: fetchWikipediaPlaceEnrichment,
  event: fetchWikipediaEventEnrichment,
};

async function enrichOneItem(item: TreeItem): Promise<{ id: string; media: EnrichedMedia }> {
  const enricher = enricherRegistry[item.type];
  if (!enricher) {
    return { id: item.id, media: {} };
  }

  try {
    const cached = await getCachedEnrichment(item.type, item.searchHint);
    if (cached && hasEnrichmentData(cached)) {
      const stalePartial =
        (item.type === "book" && bookNeedsCoverRetry(cached)) ||
        (WIKI_IMAGE_RETRY_TYPES.has(item.type) && wikiBackedButMissingImage(cached));
      if (!stalePartial) {
        return { id: item.id, media: cached };
      }
    }

    const media = await enricher(item);
    if (hasEnrichmentData(media)) {
      await setCachedEnrichment(item.type, item.searchHint, media);
    }
    return { id: item.id, media };
  } catch {
    return { id: item.id, media: {} };
  }
}

/** Parallel enrichment with Postgres-backed cache; failures degrade to empty media per item. */
export async function enrichTree(tree: CultureTree): Promise<Map<string, EnrichedMedia>> {
  const enrichments = new Map<string, EnrichedMedia>();

  const results = await Promise.allSettled(tree.items.map(async (item) => enrichOneItem(item)));

  for (const result of results) {
    if (result.status === "fulfilled") {
      enrichments.set(result.value.id, result.value.media);
    }
  }

  return enrichments;
}
