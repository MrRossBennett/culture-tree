# Image Provenance PRD

## Problem Statement

Culture Tree currently displays branch and entity images using external image URLs from enrichment providers such as TMDB, Google Books, Wikipedia, MusicBrainz, and Cover Art Archive. This is a reasonable v1 approach because the product does not need to own image binaries, resize images, run a CDN, or handle user-uploaded copyrighted media yet.

The problem is that image URLs are currently thin display fields. The application can show an image, but it cannot reliably answer where that image came from, which provider attribution applies, whether the URL was selected from an approved source, or whether a future local cache would be allowed. That makes the current approach feel accidental rather than governed.

Culture Tree needs a lightweight image provenance layer so external images remain safe and intentional for v1 without prematurely building a full media asset system.

## Solution

Keep using external image URLs for v1, but attach explicit provenance metadata whenever an entity image is selected or refreshed.

The first implementation should not introduce a new media table, local object storage, image upload, image resizing, or CDN-backed copies. Instead, it should preserve the existing `imageUrl` display field and add a small structured provenance object inside entity metadata. The provenance object should record the approved provider source, original remote URL, image kind, provider attribution link, and the time the image was selected or checked.

The app should also add a small credits or provider attribution surface so users and reviewers can understand where external media comes from. This can be simple for v1. The goal is not to explain copyright law in-product; the goal is to show that Culture Tree uses known cultural data providers and keeps image provenance available.

This work makes the current image model sustainable enough for v1 while leaving a clear path to future caching, takedown workflows, richer licensing metadata, and a normalized `entity_image` table if the product needs them later.

## User Stories

1. As a Culture Tree user, I want branch images to keep appearing normally, so that the product remains visually rich.
2. As a Culture Tree user, I want missing or broken images to degrade gracefully, so that a tree remains usable when a provider image is unavailable.
3. As a Culture Tree user, I want the product to use reputable image sources, so that displayed images feel trustworthy and relevant.
4. As a profile visitor, I want entity images to display consistently across trees and profiles, so that the same cultural thing feels recognizable.
5. As a curator, I want manually selected external search results to preserve their image source, so that selected branches remain traceable.
6. As a developer, I want to know which provider supplied an entity image, so that I can debug incorrect or stale artwork.
7. As a developer, I want entity image provenance stored with the entity display metadata, so that the resolver owns the same display facts it already writes.
8. As a developer, I want a small typed image provenance shape, so that provider-specific enrichment code does not invent slightly different metadata formats.
9. As a developer, I want provenance to be optional, so that existing entities and images continue to work during migration.
10. As a developer, I want image provenance to be additive, so that the current `imageUrl` display contract does not need a broad UI rewrite.
11. As a developer, I want image provenance to distinguish TMDB, Google Books, Wikipedia, MusicBrainz, Cover Art Archive, and user-provided values, so that source policy can be enforced later.
12. As a developer, I want image provenance to include the original remote URL, so that stale or incorrect images can be inspected and refreshed.
13. As a developer, I want image provenance to include an attribution URL where available, so that product attribution surfaces can link back to the provider or canonical page.
14. As a developer, I want image provenance to include the image kind, so that posters, book covers, album covers, thumbnails, portraits, and lead images can be understood separately.
15. As a developer, I want image provenance to include a checked timestamp, so that future refresh/backfill logic can identify stale image records.
16. As a developer, I want existing resolver tests to cover provenance on resolved entities, so that future resolver changes do not silently drop image metadata.
17. As a developer, I want the image source policy to be explicit, so that arbitrary scraped image URLs do not creep into the product unnoticed.
18. As a developer, I want provider attribution to be visible somewhere in the app, so that Culture Tree is a better citizen of the APIs it depends on.
19. As a future developer, I want this v1 provenance data to support a later `entity_image` table, so that we can normalize when there is real need.
20. As a future developer, I want this v1 provenance data to support a later local image cache decision, so that caching can be driven by known source and rights status rather than guesswork.

## Implementation Decisions

- Culture Tree will continue to display external image URLs for v1.
- The existing entity image display field remains the primary URL consumed by current UI surfaces.
- Image provenance will be added as structured data inside entity metadata for v1.
- A new normalized media or image table is out of scope for the first implementation.
- Local image storage, CDN copies, resizing, transformation, and user image uploads are out of scope for the first implementation.
- Provenance should be written when an entity image is selected, updated, or refreshed by the entity resolver.
- Provenance should be best-effort and optional so existing entities without provenance remain valid.
- The provenance shape should be centralized in a shared schema or domain helper rather than duplicated in every resolver branch.
- The provenance source should use a controlled vocabulary. Initial values should include TMDB, Google Books, Wikipedia, MusicBrainz, Cover Art Archive, user, and unknown.
- The provenance kind should use a controlled vocabulary. Initial values should include poster, cover, thumbnail, portrait, photo, lead image, and unknown.
- The provenance object should include the remote image URL that produced the current entity display image.
- The provenance object should include an attribution URL when a provider page or canonical external page is available.
- The provenance object should include the checked or selected timestamp.
- The provenance object may include provider-specific asset identifiers when they are already available, but provider asset IDs are not required for v1.
- The provenance object may include a simple rights or policy status, but detailed legal classification is not required for v1.
- Arbitrary scraped image URLs should not be introduced as approved v1 image sources.
- TMDB film and TV posters should record TMDB as the image source and link attribution to the relevant TMDB page when available.
- Google Books cover images should record Google Books as the image source and link attribution to the relevant Google Books volume page when available.
- Wikipedia lead images and thumbnails should record Wikipedia as the image source and link attribution to the relevant Wikipedia page when available.
- MusicBrainz album images that come through Cover Art Archive should record Cover Art Archive or MusicBrainz/Cover Art Archive clearly enough that later policy can distinguish them.
- Entity metadata should continue to preserve existing search hint metadata.
- Updating image provenance must not erase unrelated existing metadata on the entity.
- Backfilling existing entities is useful but should be simple and best-effort. It can infer provenance for obvious provider URL patterns and leave ambiguous rows unknown.
- A simple credits or about surface should list image/data providers used by Culture Tree.
- Provider attribution should not clutter every node card in v1 unless required by provider terms or product/legal review.
- Image load failure should continue to fall back to existing thumbnail placeholders.

The major modules to build or modify are:

- A shared image provenance schema and type.
- Entity resolver display metadata assembly.
- Source-specific resolver/enrichment adapters where image URLs are selected.
- Entity upsert behavior so provenance metadata is merged rather than overwritten.
- Optional backfill logic for existing entity image URLs.
- A small app-level credits or provider attribution surface.
- Tests around resolver output and metadata preservation.

The deepest module should be a small image provenance builder. It should accept the known source, selected image URL, entity type, external URL, and provider details, then return the normalized provenance object. This keeps source-specific resolver code simple and gives tests one stable interface for provenance policy.

## Testing Decisions

Good tests should verify externally observable behavior and domain invariants rather than implementation details. The tests should prove that when the resolver creates or updates entity display metadata, the selected image remains usable and provenance is attached without corrupting existing metadata.

Test coverage should include:

- Creating a film or TV entity with a TMDB poster stores the image URL and TMDB provenance.
- Creating a book entity with a Google Books cover stores the image URL and Google Books provenance.
- Creating a Wikipedia-backed entity with a lead image stores the image URL and Wikipedia provenance.
- Creating an album entity with Cover Art Archive artwork stores the image URL and Cover Art Archive provenance.
- Updating an existing entity image updates image provenance while preserving unrelated metadata.
- Updating an existing entity without a new image does not erase existing provenance unnecessarily.
- Entities without images remain valid and do not require provenance.
- Backfill inference classifies obvious provider URLs and leaves ambiguous image URLs as unknown.
- The UI still renders fallback thumbnails when an image URL is absent or broken.
- The credits or provider attribution surface includes the approved image/data providers.

Prior art in the codebase includes existing external-node search normalization tests, culture-tree node builder tests, Wikipedia enrichment tests, and entity resolver behavior. New tests should follow that style: focused, behavior-first, and close to the module under test.

## Out of Scope

- Downloading and storing image binaries.
- Building an object-storage bucket, CDN, or image resizing pipeline.
- User-uploaded images.
- Arbitrary web image scraping.
- A full `entity_image` table.
- Admin media management.
- Manual image replacement UI.
- Per-image legal review workflow.
- Automated copyright classification.
- Takedown request tooling.
- Provider-specific compliance automation beyond basic attribution and provenance.
- Rewriting node cards, tree previews, or profile grids.
- Replacing current enrichment providers.
- Perfect backfill of every historical image URL.

## Further Notes

This PRD intentionally keeps the v1 scope small. The important product decision is that external image links are acceptable for now, but they should be governed. The application should know where an image came from, which source supplied it, and what attribution link belongs with it.

Film posters, album covers, book covers, and artwork images should not be treated as public domain by default. The provenance layer does not solve copyright questions by itself, but it gives Culture Tree the information needed to make better provider, attribution, caching, and takedown decisions later.

The likely future migration path is from entity metadata provenance to a normalized image table only when the product needs multiple images per entity, local caching, user curation, admin review, or richer rights management.
