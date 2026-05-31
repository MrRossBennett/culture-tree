# Build culture search on an app-owned canonical entity store

Culture Tree is "Letterboxd for the wider gamut of culture" — themed lists (Trees) of canonical works across film, music, books, and beyond. Like Letterboxd, the product will own a **canonical entity store** of works; external authorities (TMDB, MusicBrainz, Open Library, Wikidata) **seed and enrich** that store rather than being blended live at search time. Search becomes "find or mint a canonical entity", and candidate works are ordered by **notability**, never by destructive heuristics. This extends ADR 0003 (curator-first, no arbitrary uploads): the entity store is where "every Branch resolves to a Recognized Cultural Subject" is actually enforced.

## Considered Options

- **Blend multiple APIs into one ranked list at search time** (the original approach). Produced a mishmash — an album, a fake documentary, and a song competing on one score — because cross-source scores aren't comparable and there is no shared notability signal. Rejected.
- **Per-medium live search with destructive intent classification** (the two-hop attempt: "if a confident creator matches, suppress the work search"). Brittle: an obscure band named "Rubber Soul" hijacks the famous Beatles album because exact-name matches suppressed the work interpretation entirely. Binary classification with no notability arbitration is structurally wrong. Rejected.
- **App-owned canonical entity store, seeded/enriched from open authorities, candidates ranked by notability** (chosen). One canonical record per work; Trees reference internal entity IDs. Mirrors how Letterboxd uses TMDB — as a seed/enrichment source, not a live dependency. Builds on the existing `entity-resolver.server.ts` (resolution, caching, linking, likes), which is the seed of this store.

## Decisions

- **One canonical record per work, owned by the app.** Trees and likes reference internal entity IDs; the external `identity` (`{source, externalId}`) is how the record was resolved/enriched, not what Trees point at directly.
- **One specialist authority owns each medium's record** (quality follows the specialist's media): film/TV → **TMDB**; music → **MusicBrainz + Cover Art Archive**; books → **Open Library**. **Wikidata** is the cross-medium hub (canonical IDs + cross-links to the specialists) and the authority for the long tail (artworks, events, places). Phase 1 keeps Wikidata as hub/long-tail rather than the universal spine; promoting it to the spine (and using it for thematic seeding) is a later evolution.
- **Spotify and Google Books are dropped.** For a product that _stores_ canonical metadata, the source must be openly licensed: Spotify's ToS forbids storing/displaying its catalogue outside their player, and its quota is unworkable; MusicBrainz (CC0) and Open Library are both open and quota-free. Google Books' edition soup loses to Open Library's work-level records.
- **Rank by notability; never destructively classify.** Search surfaces both creators (expandable, non-addable) and works (addable), grouped by medium, ordered by a notability signal. A creator interpretation only leads when nothing more notable competes, so "Rubber Soul" leads with the Beatles album while "Radiohead" leads with the artist.
- **Creators remain an expandable layer, not addable nodes** (unchanged from the works-only model) — the direct analogue of Letterboxd's director/actor pages.

## Consequences

- Work splits into two layers: an **entity layer** (extend `entity-resolver` into a first-class canonical works store with a notability signal — the spine) and **search** (find-or-mint against that store, grouped by medium, creator-first expansion retained, no blend, no suppression).
- The current live-blend and two-hop "suppress works" search logic in `packages/engine/src/search/nodes.ts` is superseded; the `kind` discriminant (`addable-work` / `expandable-subject`) and creator-first expansion UX survive into the new model.
- Each medium needs an ingestion/enrichment path to its specialist authority; MusicBrainz replaces Spotify and Open Library replaces Google Books. Cover/image provenance continues per the existing image-provenance schema.
- A future **work page** ("one OK Computer, referenced by many Trees") becomes the network layer, and a Wikidata-backed spine opens **thematic seeding** ("film noir directors", "California 1969") — the product's natural growth path, deferred for now.
- Free-text, uploaded images, and arbitrary links remain non-Branches (ADR 0003 upheld): if it can't resolve to a canonical entity, it isn't a node.
