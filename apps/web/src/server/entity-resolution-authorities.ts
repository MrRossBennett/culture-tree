import type { ExternalNodeSourceValue, NodeTypeValue } from "@repo/schemas";

const WIKIPEDIA_FALLBACK_TYPES = new Set<NodeTypeValue>(["person", "place", "event", "artwork"]);

export function wikipediaFallbackTypes(): ReadonlySet<NodeTypeValue> {
  return WIKIPEDIA_FALLBACK_TYPES;
}

// Wikidata is the canonical spine (ADR 0004): it can mint every Branch Type and is the primary
// authority for resolving identity-less items. Specialist sources still mint the works that
// creator expansion produces directly — TMDB for film/TV, MusicBrainz for music — where the
// item already carries that specialist's identity (no title search, no notability arbitration).
export function sourceCanCreateEntityForType(
  source: ExternalNodeSourceValue,
  type: NodeTypeValue,
): boolean {
  if (source === "wikidata") {
    return true;
  }
  if (type === "film" || type === "tv") {
    return source === "tmdb";
  }
  if (type === "artist" || type === "album" || type === "song") {
    return source === "musicbrainz";
  }
  if (WIKIPEDIA_FALLBACK_TYPES.has(type)) {
    return source === "wikipedia";
  }
  return false;
}

// The authority that mints a fresh entity from an identity-less item is always Wikidata now.
export function primarySourceForType(_type: NodeTypeValue): ExternalNodeSourceValue {
  return "wikidata";
}
