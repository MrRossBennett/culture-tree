import type { ExternalNodeSourceValue, NodeTypeValue } from "@repo/schemas";

const WIKIPEDIA_FALLBACK_TYPES = new Set<NodeTypeValue>(["person", "place", "event", "artwork"]);

export function wikipediaFallbackTypes(): ReadonlySet<NodeTypeValue> {
  return WIKIPEDIA_FALLBACK_TYPES;
}

export function sourceCanCreateEntityForType(
  source: ExternalNodeSourceValue,
  type: NodeTypeValue,
): boolean {
  if (type === "film" || type === "tv") {
    return source === "tmdb";
  }
  if (type === "artist" || type === "album" || type === "song") {
    return source === "musicbrainz";
  }
  if (type === "book") {
    return source === "google-books";
  }
  if (WIKIPEDIA_FALLBACK_TYPES.has(type)) {
    return source === "wikipedia";
  }
  return false;
}

export function primarySourceForType(type: NodeTypeValue): ExternalNodeSourceValue {
  if (type === "film" || type === "tv") {
    return "tmdb";
  }
  if (type === "artist" || type === "album" || type === "song") {
    return "musicbrainz";
  }
  if (type === "book") {
    return "google-books";
  }
  return "wikipedia";
}
