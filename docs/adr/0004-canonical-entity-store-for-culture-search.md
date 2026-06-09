# Build culture search on an app-owned canonical entity store

Culture Tree is "Letterboxd for the wider gamut of culture" — themed lists (Trees) of canonical works across film, music, books, and beyond. Like Letterboxd, the product will own a **canonical entity store** of works; external authorities (TMDB, MusicBrainz, Open Library, Wikidata) **seed and enrich** that store rather than being blended live at search time. Search becomes "find or mint a canonical entity", and candidate works are ordered by **notability**, never by destructive heuristics. This extends ADR 0003 (curator-first, no arbitrary uploads): the entity store is where "every Branch resolves to a Recognized Cultural Subject" is actually enforced.

## Considered Options

- **Blend multiple APIs into one ranked list at search time** (the original approach). Produced a mishmash — an album, a fake documentary, and a song competing on one score — because cross-source scores aren't comparable and there is no shared notability signal. Rejected.
- **Per-medium live search with destructive intent classification** (the two-hop attempt: "if a confident creator matches, suppress the work search"). Brittle: an obscure band named "Rubber Soul" hijacks the famous Beatles album because exact-name matches suppressed the work interpretation entirely. Binary classification with no notability arbitration is structurally wrong. Rejected.
- **App-owned canonical entity store, seeded/enriched from open authorities, candidates ranked by notability** (chosen). One canonical record per work; Trees reference internal entity IDs. Mirrors how Letterboxd uses TMDB — as a seed/enrichment source, not a live dependency. Builds on the existing `entity-resolver.server.ts` (resolution, caching, linking, likes), which is the seed of this store.

## Decisions

- **One canonical record per work, owned by the app.** Trees and likes reference internal entity IDs; the external `identity` (`{source, externalId}`) is how the record was resolved/enriched, not what Trees point at directly.
- **Wikidata is the spine: the canonical entity and the notability ranking; specialists supply the media.** Each work's canonical record and cross-links come from Wikidata (QID, `P31 instance of` for type, `P50` author/creator, `P577` date, `P212`/`P957` ISBN, `P648` Open Library ID, etc.), and candidates are ranked by **sitelink count** (number of Wikipedia language editions) as the notability signal. Specialists provide the rich media a Wikidata item lacks: film/TV posters → **TMDB**; album covers → **Cover Art Archive** (via the MusicBrainz ID); book covers → **Open Library** (by ISBN). This is what fixes the music-notability gap ("bowie" → an obscure band today) and books in one move. Wikidata also remains the authority for the long tail (artworks, events, places).
- **Open Library is a cover provider, not a search/record source.** Its crowd-sourced metadata and search relevance are weak, but its ISBN-keyed cover images are reliable — so the book _record_ comes from Wikidata and Open Library only supplies the cover URL.
- **Spotify and Google Books are dropped.** For a product that _stores_ canonical metadata, the source must be openly licensed: Spotify's ToS forbids storing/displaying its catalogue outside their player (and its quota is unworkable); Google Books' ToS restricts storage and it has no work-level model. MusicBrainz, Wikidata, Open Library, and Cover Art Archive are all open.
- **Rank by notability; never destructively classify.** Search surfaces both creators (expandable, non-addable) and works (addable), grouped by medium, ordered by a notability signal. A creator interpretation only leads when nothing more notable competes, so "Rubber Soul" leads with the Beatles album while "Radiohead" leads with the artist.
- **Creators remain an expandable layer, not addable nodes** (unchanged from the works-only model) — the direct analogue of Letterboxd's director/actor pages.

## How the Wikidata spine works (worked example: "Dune")

1. **Search Wikidata** for the query (`wbsearchentities`) → candidate QIDs (the novel, the 2021 film, the band, a game…).
2. **Batch-fetch properties and filter by `P31`** to the medium in question → keep only the book candidates (drops the film/band/game).
3. **Rank by sitelink count** → Frank Herbert's _Dune_ (~60 sitelinks) leads over an obscure self-published _Dune_ (0–1). This is the notability arbitration the old heuristics lacked.
4. **Build the record**: name, type `book`, year (`P577`), creator (`P50`), identity `{source: "wikidata", externalId: "<QID>"}`.
5. **Enrich the cover** from the work itself: read ISBN (`P212`) → construct the Open Library cover URL (`https://covers.openlibrary.org/b/isbn/<isbn>-L.jpg`) into `snapshot.image`. No extra fetch — the browser loads it, and the existing `CoverImage` component falls back to a placeholder on 404. Cover fallback chain: **ISBN→Open Library → Wikidata `P18` (Commons) → type placeholder.**

The same shape applies to every medium — Wikidata for the entity + notability, a specialist for the media (TMDB posters, Cover Art Archive covers, Open Library covers). The one risk to de-risk first (see Consequences): Wikidata entity search doesn't rank by type/notability on its own, so step 2–3 (filter + sitelink sort, or one SPARQL query) must reliably return the right work.

## Consequences

- **Build the Wikidata spine first** — it delivers books _and_ fixes the music-notability gap ("bowie" → wrong artist) in one move, so it precedes any standalone per-medium work. Sequence: (1) **spike** — validate that Wikidata search ranked by sitelink count returns the right work for ~20 representative queries (e.g. "Dune", "Beloved", "1984", "It", "Rubber Soul", "bowie"); if so, (2) build the entity layer + Wikidata-backed search, (3) attach the specialist cover/media enrichers (TMDB, Cover Art Archive, Open Library).
- Work splits into two layers: an **entity layer** (extend `entity-resolver` into a first-class canonical works store keyed on Wikidata QIDs with a notability signal) and **search** (find-or-mint against that store, grouped by medium, creator-first expansion retained, no blend, no suppression).
- The current live-blend / two-hop search logic in `packages/engine/src/search/nodes.ts` is superseded; the `kind` discriminant (`addable-work` / `expandable-subject`) and creator-first expansion UX survive into the new model.
- **Open Library shrinks to a ~5-line cover-URL helper** (ISBN → cover image); there is no standalone "book search source" to build. MusicBrainz stays for music records + the Cover Art Archive ID. Cover/image provenance continues per the existing `image-provenance` schema.
- A future **work page** ("one OK Computer, referenced by many Trees") becomes the network layer, and the Wikidata spine opens **thematic seeding** ("film noir directors", "California 1969") via SPARQL — the product's natural growth path.
- Free-text, uploaded images, and arbitrary links remain non-Branches (ADR 0003 upheld): if it can't resolve to a canonical entity, it isn't a node.

## Update — implementation decisions (2026-05-31)

The spike passed (Wikidata `wbsearchentities` at limit ~50 → `wbgetentities` for `P31` + sitelinks → classify → rank by sitelink count returned the right entity on 20/20 representative queries, including the headline "bowie" and "It" once the limit was raised). Building the spine surfaced three clarifications, now implemented:

- **Search is read-only; "find-or-mint" is an add-time operation.** Search queries Wikidata live (cached) and ranks candidates without writing anything. A canonical `entity` row is minted only when a Branch is actually added to a Tree (`resolveTreeItem`). The store therefore only ever holds works someone curated — exactly like Letterboxd creates a film record when a film is logged, not when it's typed into search.
- **Results are filterable-by-medium, not grouped into forced sections.** "Grouped by medium" above is realised as a single flat list ranked by notability with Branch Type as a filter (consistent with `CONTEXT.md`: Branch Types are filters, not authored groupings). The most notable match leads regardless of medium. Ranking is two-tier: a _notable_ exact-title match leads (floored so a junk exact match can't beat a famous prefix match), then sitelink count.
- **Creators are Wikidata-identified but specialist-expanded.** Wikidata identifies and ranks the creator (fixing "bowie" → David Bowie); expansion into their works still uses the specialist (MusicBrainz discography via `P434`, TMDB filmography via `P4985`), because Wikidata's own work back-links are too patchy. A creator with no specialist cross-link (most book authors) is simply addable with no expansion.

Implementation: `packages/engine/src/search/wikidata.ts` (client + classification + cover constructors), a rewritten `packages/engine/src/search/nodes.ts` (~370 lines, down from ~1,683 — the per-source blend/score/dedup machinery is gone), and a unified `resolveTreeItem` in `apps/web/src/server/entity-resolver.server.ts` (one Wikidata find-or-mint path; the per-medium TMDB/MusicBrainz/Google Books/Wikipedia title-search resolvers were retired). Creators became addable Branches — see ADR 0005. ISBN/cover details and the `wikidata`/`open-library` provenance sources follow this record.
