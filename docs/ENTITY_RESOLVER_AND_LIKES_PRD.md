# Entity Resolver and Global Likes PRD

## Problem Statement

Culture Tree branches currently behave like local items inside a single generated tree. If two users generate trees that both contain `Taxi Driver`, those branch instances can exist independently with no guaranteed relationship to the same underlying cultural work. That makes a global liking system unsafe: a user might think they are liking "Taxi Driver", but the application may only know about a local branch placement in one tree.

The product needs a Letterboxd/Spotify-style model where users like "the thing" itself. A like should attach to the canonical cultural entity, not to a branch's position, reason, parent, or tree-specific relationship. Before likes can be built, Culture Tree needs a first-class resolver service that can turn generated or manually added branches into canonical entities when confidence is high.

The current codebase has useful foundations: tree items can carry optional external identity metadata, enrichment already calls external cultural APIs, and manually selected search results preserve identity. But there is no normalized canonical entity table, no global entity identity model, no tree-item-to-entity link table, no MusicBrainz integration, and no resolver service that owns canonicalization policy.

## Solution

Build a first-class canonical entity resolver, then layer global likes on top of resolved entities.

The resolver will take branch data, existing search hints, enrichment output, and optional external identities, then determine whether the branch can confidently map to a canonical Culture Tree entity. If it can, the resolver will create or reuse the canonical entity, attach one or more external identities, and link the tree item to that entity. If it cannot resolve confidently, the branch still appears in the tree but receives no like affordance.

Global likes will attach only to canonical entities. Users will be able to like and unlike resolved branches, and their profile will include a public list of liked entities. The first version will not include standalone entity pages, but the data model should be ready for them.

Resolution should run automatically as part of generation/enrichment, but it should be best-effort and queue/cache-aware. Tree creation should not block on slow external resolution, especially for MusicBrainz, which requires a meaningful user agent and conservative request pacing.

## User Stories

1. As a signed-in user, I want to like a resolved cultural thing from a tree, so that I can save it to my taste profile.
2. As a signed-in user, I want my like to apply globally to the thing itself, so that liking `Taxi Driver` in one tree means I have liked `Taxi Driver` everywhere.
3. As a signed-in user, I want to unlike a thing, so that I can remove it from my liked list.
4. As a signed-in user, I want to see whether I have already liked a thing, so that the interface reflects my existing taste record.
5. As a signed-in user, I want like counts to represent global likes for a thing, so that popular entities are counted consistently across trees.
6. As a signed-in user, I want my profile to show my liked things, so that my profile becomes a public taste surface.
7. As a profile visitor, I want to see a user's liked things, so that I can understand their cultural taste.
8. As a user viewing a tree, I want like controls to appear only when the system knows the underlying thing, so that I am not asked to like ambiguous or fuzzy branches.
9. As a user viewing a tree, I do not want to see technical unresolved-state messages, so that the tree experience remains clean and magical.
10. As a user viewing a generated branch for `Taxi Driver`, I want that branch to refer to the same canonical film as every other resolved `Taxi Driver` branch, so that Culture Tree behaves like a cultural graph rather than isolated JSON documents.
11. As a user viewing music branches, I want artists, albums, and songs to resolve to music-specific identities, so that music likes are not built on weak Wikipedia fallbacks.
12. As a user liking an album, I want to like the album broadly rather than a specific pressing or edition, so that the behavior matches how people normally think about albums.
13. As a user liking a song, I want to like the recognizable recording, so that the behavior matches a Spotify-like mental model.
14. As a user, I want old and new generated trees to be eligible for resolution, so that the global graph can improve over time.
15. As a curator, I want manually selected search-result branches to preserve their canonical identity, so that manual additions become likeable when they are backed by trusted external IDs.
16. As a curator, I want freeform or concept branches to remain displayable even when not likeable, so that expressive trees are not constrained only to externally indexed works.
17. As a future product user, I want entity pages to be possible later, so that each thing can eventually have its own page with likes, appearances, metadata, and related trees.
18. As a future product user, I want one Culture Tree entity to support multiple external identities, so that an entity can connect TMDB, Wikipedia, IMDb, Wikidata, Spotify, or other identifiers over time.
19. As a developer, I want exact external identity reuse to be guaranteed, so that the same TMDB movie or MusicBrainz MBID cannot create duplicate entities.
20. As a developer, I want resolver policy to live in a domain service, so that web routes do not accumulate fragile matching logic.
21. As a developer, I want resolution jobs to be durable and retryable, so that external API slowness or rate limits do not make tree creation unreliable.
22. As a developer, I want resolver output to be testable through a stable interface, so that canonicalization behavior can be improved safely.
23. As a developer, I want the resolver to prefer no match over a wrong match, so that global likes and future entity pages do not become polluted.
24. As a developer, I want external API lookups to be cached, so that repeated popular entities do not repeatedly hit third-party services.
25. As a developer, I want MusicBrainz calls to respect service guidelines, so that Culture Tree remains a good API citizen.

## Implementation Decisions

- Likes attach to canonical entities, not to tree-specific branch instances.
- A canonical entity is created only after confident external resolution.
- Branches that are not confidently resolved remain visible in the tree but are not likeable in the first version.
- The UI should not expose technical terms such as unresolved, resolving, identifying, or failed resolution.
- Resolution runs automatically as part of the generation/enrichment lifecycle, but tree creation should not be blocked by slow resolver completion.
- The resolver should be a first-class domain service with a stable public interface, not route-local matching logic.
- Resolver jobs should be per tree item for the first implementation. This keeps linking, retries, and backfills straightforward.
- Per-tree-item jobs are acceptable for scale as long as external lookup work is deduplicated through identity reuse and resolver/search caching.
- The resolver should check local links, external identities, and caches before making third-party API calls.
- The resolver should be conservative. A missed match is preferable to a wrong match.
- Each node type has a primary authority for entity creation:
  - `film` and `tv` use TMDB.
  - `artist`, `album`, and `song` use MusicBrainz.
  - `book` uses Google Books for the first version.
  - `person`, `place`, `event`, `artwork`, and `article` use Wikipedia fallback.
- MusicBrainz should be integrated before music-related likes launch.
- MusicBrainz requires no API key for the first version. The client must send a meaningful `User-Agent`, cache or deduplicate lookups where possible, and respect conservative source-IP pacing.
- MusicBrainz artist branches map to MusicBrainz artists.
- MusicBrainz album branches map to release groups, not releases.
- MusicBrainz song branches map to recordings for the first version.
- The entity type should reuse the existing branch/node type vocabulary for the first version.
- External identities should include source, source-specific external type, and external ID.
- A Culture Tree entity can have many external identities.
- Each external identity can belong to only one Culture Tree entity.
- The database should enforce uniqueness for each external identity tuple.
- Entity creation is controlled by the primary authority for the branch type. Secondary identities may be attached to an existing entity, but should not create competing entities for types with a primary authority.
- Entities should include page-ready display metadata even though standalone entity pages are out of scope for this PRD.
- Entities should have a primary external identity pointer for display provenance, without making that the only identity truth.
- Tree-item-to-entity attachment should live in normalized relational tables, not only inside tree JSON.
- Tree JSON may eventually denormalize entity IDs for UI convenience, but normalized tables are the source of truth.
- The likes table should be pure and global: user, entity, created timestamp, and a uniqueness guarantee.
- Likes should not store the tree or branch where the like originated.
- Like-origin analytics, if desired later, should be handled separately from the domain like model.
- Likes are public on the user's profile for the first version.
- Standalone entity pages are intentionally not part of this work, but the data model should support them later.
- Existing trees should be backfillable through the same resolver service and job model.
- Manual/admin merge tooling is not required for the first version, but future merge behavior should be possible by reassigning external identities, tree-item links, and likes.

The major modules to build or modify are:

- Canonical entity schema and migrations.
- External identity schema and migrations.
- Tree-item-to-entity link schema and migrations.
- Entity resolution job schema and migrations.
- Entity likes schema and migrations.
- Resolver domain service.
- Source-specific resolver adapters for TMDB, MusicBrainz, Google Books, and Wikipedia.
- Confidence and matching utilities.
- Resolver queue processor or runner.
- Generation/enrichment integration that creates immediate links where possible and enqueues remaining tree items.
- Server functions for like, unlike, like state, like counts, and liked profile lists.
- Tree branch UI that shows like controls only for resolved entities.
- Profile UI that lists liked entities.
- Backfill script or command for existing tree data.

The resolver should expose a small, stable interface that hides source-specific complexity. Suggested capabilities include:

- Resolve all eligible items in a tree.
- Resolve one tree item.
- Upsert an entity from a primary external identity.
- Link a tree item to a resolved entity.
- Enqueue unresolved eligible items for asynchronous resolution.
- Process pending resolution jobs in small batches while respecting source limits.

## Testing Decisions

Good tests should verify externally observable behavior and domain invariants rather than implementation details. Resolver tests should focus on inputs, outputs, persisted links, uniqueness guarantees, and conservative matching behavior.

The resolver should be treated as a deep module: a lot of matching policy and source-specific behavior should be encapsulated behind a small public interface that can be tested in isolation.

Test coverage should include:

- Reusing an existing entity when the same external identity is resolved again.
- Creating a new entity when a strong primary-authority identity is found for the first time.
- Refusing to create an entity when the resolver has no confident primary-authority match.
- Preventing duplicate entities for the same external identity.
- Linking multiple tree items to the same entity.
- Leaving unresolved branches visible but not likeable.
- Ensuring a user can like an entity once.
- Ensuring like/unlike operations are idempotent from the user's perspective.
- Ensuring like counts are global per entity.
- Ensuring the profile liked list returns entities, not branch placements.
- Ensuring MusicBrainz album resolution uses release groups.
- Ensuring MusicBrainz song resolution uses recordings.
- Ensuring MusicBrainz artist resolution uses artists.
- Ensuring resolver jobs can be retried without duplicating links or entities.
- Ensuring queued resolution does not block tree creation.
- Ensuring source-specific rate limiting is represented in the runner behavior.

Prior art in the codebase includes existing schema-level Zod parsing tests, generation pipeline tests, external-node search normalization tests, and culture-tree node builder tests. New tests should follow that style: focused, behavior-first, and close to the module under test.

## Out of Scope

- Standalone entity pages.
- Public browsing/searching of all entities.
- Manual/admin entity merge UI.
- Automatic cross-source fuzzy merging.
- Importing likes from external services.
- Following users or social activity feeds.
- Ratings, reviews, diary entries, watch/listen/read status, or ranked lists.
- Playlist/list creation beyond the implicit liked-entities list.
- Rich analytics for where a like originated.
- Full worker infrastructure beyond a lightweight queue/runner foundation.
- Perfect canonicalization for every possible cultural object.
- Replacing Google Books with a stronger book authority.
- Spotify, Apple Music, Last.fm, IMDb, Wikidata, or Open Library integrations.

## Further Notes

This PRD intentionally treats likes as the dependent feature. The real foundation is canonical entity resolution. Once tree items can reliably point to global entities, likes become a small and safe feature.

The most important invariant is: if a branch is likeable, it already has a canonical entity ID. If the resolver cannot confidently identify the thing, the branch remains part of the tree but does not expose like UI.

The data model should support entity pages later without building them now. A future entity page should be able to show canonical metadata, external identities, like counts, users who liked the entity, trees where the entity appears, and related entities inferred from co-occurrence.

MusicBrainz usage requires no API key for the first version. It should follow current service guidance: send a meaningful `User-Agent`, cache aggressively or deduplicate lookups, avoid repeated lookups, and respect the 1 request/second source-IP guideline.
