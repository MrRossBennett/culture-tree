import type { CultureTree, EnrichedMedia, NodeTypeValue, TreeNode } from "@repo/schemas";

import { fetchBookEnrichment } from "./books";
import { getCachedEnrichment, setCachedEnrichment } from "./cache";
import { fetchFilmEnrichment, fetchTvEnrichment } from "./films";
import { flattenBranchNodes } from "./flatten";
import {
  fetchWikipediaArtworkEnrichment,
  fetchWikipediaEnrichment,
  fetchWikipediaMusicEnrichment,
  fetchWikipediaSongEnrichment,
} from "./wikipedia";

type Enricher = (node: TreeNode) => Promise<EnrichedMedia>;

function hasEnrichmentData(media: EnrichedMedia): boolean {
  return Object.keys(media).length > 0;
}

/** Books cached before Wikipedia cover fallback (or bad GB hits) can have links but no art — re-run enricher. */
function bookNeedsCoverRetry(cached: EnrichedMedia): boolean {
  const noArt = !cached.coverUrl?.trim() && !cached.thumbnailUrl?.trim();
  return noArt && Boolean(cached.externalUrl?.trim() || cached.description?.trim());
}

/** Wikipedia-backed row with text/URL but no lead image yet — re-fetch (artwork, song, article, publication). */
function wikiBackedButMissingImage(cached: EnrichedMedia): boolean {
  const noArt = !cached.coverUrl?.trim() && !cached.thumbnailUrl?.trim();
  return noArt && Boolean(cached.wikipediaUrl?.trim() || cached.wikiExtract?.trim());
}

const enricherRegistry: Partial<Record<NodeTypeValue, Enricher>> = {
  book: fetchBookEnrichment,
  film: fetchFilmEnrichment,
  tv: fetchTvEnrichment,
  album: fetchWikipediaMusicEnrichment,
  song: fetchWikipediaSongEnrichment,
  person: fetchWikipediaEnrichment,
  artist: fetchWikipediaEnrichment,
  /** Stand-alone piece (essay, feature, notable post) — Wikipedia when wikiSlug/title matches. */
  article: fetchWikipediaEnrichment,
  /** Periodical: magazine, zine, journal, newspaper — same Wikipedia enrichment as article. */
  publication: fetchWikipediaEnrichment,
  artwork: fetchWikipediaArtworkEnrichment,
};

async function enrichOneBranchNode(
  nodeId: string,
  node: TreeNode,
): Promise<{ id: string; media: EnrichedMedia }> {
  const enricher = enricherRegistry[node.type];
  if (!enricher) {
    return { id: nodeId, media: {} };
  }

  try {
    const cached = await getCachedEnrichment(node.type, node.searchHint);
    if (cached && hasEnrichmentData(cached)) {
      const stalePartial =
        (node.type === "book" && bookNeedsCoverRetry(cached)) ||
        ((node.type === "artwork" ||
          node.type === "song" ||
          node.type === "article" ||
          node.type === "publication") &&
          wikiBackedButMissingImage(cached));
      if (!stalePartial) {
        return { id: nodeId, media: cached };
      }
    }

    const media = await enricher(node);
    if (hasEnrichmentData(media)) {
      await setCachedEnrichment(node.type, node.searchHint, media);
    }
    return { id: nodeId, media };
  } catch {
    return { id: nodeId, media: {} };
  }
}

/** Parallel enrichment with Postgres-backed cache; failures degrade to empty media per node. */
export async function enrichTree(tree: CultureTree): Promise<Map<string, EnrichedMedia>> {
  const flat = flattenBranchNodes(tree);
  const results = await Promise.allSettled(
    flat.map(({ id, node }) => enrichOneBranchNode(id, node)),
  );

  const enrichments = new Map<string, EnrichedMedia>();
  for (const result of results) {
    if (result.status === "fulfilled") {
      enrichments.set(result.value.id, result.value.media);
    }
  }
  return enrichments;
}
