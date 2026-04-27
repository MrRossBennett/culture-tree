# Image Provenance Issue Plan

Parent PRD: [Image Provenance PRD](./IMAGE_PROVENANCE_PRD.md)

This issue plan breaks the PRD into small tracer-bullet slices. The early slices establish a typed provenance contract, then later slices wire it into entity resolution, preserve historical data, add provider attribution, and lock the behavior down with regression coverage.

## Proposed Breakdown

1. **Image Provenance Schema and Builder**
   - **Type:** AFK
   - **Blocked by:** None
   - **User stories covered:** 6, 8, 9, 10, 11, 12, 13, 14, 15, 19, 20

2. **Write Provenance During Entity Resolution**
   - **Type:** AFK
   - **Blocked by:** Image Provenance Schema and Builder
   - **User stories covered:** 3, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17

3. **Preserve and Backfill Existing Image Metadata**
   - **Type:** AFK
   - **Blocked by:** Write Provenance During Entity Resolution
   - **User stories covered:** 6, 9, 12, 15, 17, 19, 20

4. **Credits and Provider Attribution Surface**
   - **Type:** HITL
   - **Blocked by:** Image Provenance Schema and Builder
   - **User stories covered:** 3, 13, 18

5. **Fallback and Provenance Regression Coverage**
   - **Type:** AFK
   - **Blocked by:** Write Provenance During Entity Resolution, Credits and Provider Attribution Surface
   - **User stories covered:** 1, 2, 4, 9, 10, 16, 18

---

## Issue 1: Image Provenance Schema and Builder

## Parent PRD

[Image Provenance PRD](./IMAGE_PROVENANCE_PRD.md)

## What to build

Create the small shared provenance contract that every later slice will use. The application should have one typed image provenance shape and one helper for producing normalized provenance objects from provider-specific resolver inputs.

This slice should not change entity display behavior. It establishes the vocabulary and helper surface only.

## Acceptance criteria

- [ ] A shared image provenance schema and type exist for entity image metadata.
- [ ] The provenance source uses a controlled vocabulary that includes TMDB, Google Books, Wikipedia, MusicBrainz, Cover Art Archive, user, and unknown.
- [ ] The provenance kind uses a controlled vocabulary that includes poster, cover, thumbnail, portrait, photo, lead image, and unknown.
- [ ] The provenance shape supports remote image URL, optional attribution URL, optional provider asset ID, optional rights or policy status, and checked timestamp.
- [ ] A small builder/helper can normalize provider-specific input into the shared provenance shape.
- [ ] The helper is safe for missing or partial input and can return no provenance when there is no image URL.
- [ ] Unit tests cover source normalization, kind normalization, missing input, and timestamp behavior.

## Blocked by

None - can start immediately.

## User stories addressed

- User story 6
- User story 8
- User story 9
- User story 10
- User story 11
- User story 12
- User story 13
- User story 14
- User story 15
- User story 19
- User story 20

---

## Issue 2: Write Provenance During Entity Resolution

## Parent PRD

[Image Provenance PRD](./IMAGE_PROVENANCE_PRD.md)

## What to build

Wire image provenance into the entity resolver paths that select entity display images. When the resolver writes or updates an entity image URL from an approved provider, it should also write structured provenance into entity metadata while preserving the existing public image URL contract.

This slice should keep the UI working exactly as it does today. The externally visible behavior is that branch/entity images still render, while the entity record now knows where each image came from.

## Acceptance criteria

- [ ] TMDB film and TV poster images write TMDB provenance with a relevant attribution URL when available.
- [ ] Google Books cover images write Google Books provenance with a relevant attribution URL when available.
- [ ] Wikipedia lead images and thumbnails write Wikipedia provenance with a relevant attribution URL when available.
- [ ] MusicBrainz album images that come from Cover Art Archive write provenance that clearly identifies Cover Art Archive or MusicBrainz/Cover Art Archive.
- [ ] Manual selected search-result branches preserve trusted image source details when available.
- [ ] Entities without images remain valid and do not require provenance.
- [ ] Existing `imageUrl` consumers do not need to change for this slice.
- [ ] Tests prove resolved entities store both the display image URL and matching provenance for at least TMDB, Google Books, Wikipedia, and Cover Art Archive-backed paths.

## Blocked by

- Blocked by Issue 1: Image Provenance Schema and Builder.

## User stories addressed

- User story 3
- User story 5
- User story 6
- User story 7
- User story 10
- User story 11
- User story 12
- User story 13
- User story 14
- User story 15
- User story 16
- User story 17

---

## Issue 3: Preserve and Backfill Existing Image Metadata

## Parent PRD

[Image Provenance PRD](./IMAGE_PROVENANCE_PRD.md)

## What to build

Make image provenance safe for existing entity metadata and historical rows. Entity updates should merge image provenance without erasing unrelated metadata, and a best-effort backfill should classify obvious existing provider URLs while leaving ambiguous rows marked unknown or untouched.

This slice exists to make the provenance feature usable on real data, not only newly resolved entities.

## Acceptance criteria

- [ ] Entity image updates merge provenance into metadata without erasing existing search hints or unrelated metadata fields.
- [ ] Updating an entity without a new image does not unnecessarily erase existing image provenance.
- [ ] Existing entities with obvious TMDB image URLs can be classified as TMDB-backed.
- [ ] Existing entities with obvious Google Books image URLs can be classified as Google Books-backed.
- [ ] Existing entities with obvious Wikimedia image URLs can be classified as Wikipedia-backed.
- [ ] Existing entities with obvious Cover Art Archive image URLs can be classified as Cover Art Archive-backed.
- [ ] Ambiguous image URLs are left as unknown or left unchanged rather than guessed as an approved source.
- [ ] The backfill is idempotent and can be rerun without corrupting metadata.
- [ ] Tests cover metadata preservation, repeated backfill runs, obvious provider inference, and ambiguous URL handling.

## Blocked by

- Blocked by Issue 2: Write Provenance During Entity Resolution.

## User stories addressed

- User story 6
- User story 9
- User story 12
- User story 15
- User story 17
- User story 19
- User story 20

---

## Issue 4: Credits and Provider Attribution Surface

## Parent PRD

[Image Provenance PRD](./IMAGE_PROVENANCE_PRD.md)

## What to build

Add a small public-facing provider attribution surface for the approved image and data sources used by Culture Tree. The first version should be simple, easy to find, and low-clutter. It should not add attribution text to every tree node unless product or legal review later requires that.

This slice is marked HITL because the exact wording and placement may need product/legal taste before merge.

## Acceptance criteria

- [ ] The app has a simple credits, about, or provider attribution surface.
- [ ] The surface lists the approved providers currently used for image and cultural metadata enrichment.
- [ ] The surface includes attribution/link text for TMDB.
- [ ] The surface includes attribution/link text for Google Books.
- [ ] The surface includes attribution/link text for Wikipedia/Wikimedia where appropriate.
- [ ] The surface includes attribution/link text for MusicBrainz and Cover Art Archive where appropriate.
- [ ] The surface avoids making broad public-domain claims about posters, covers, or artwork images.
- [ ] The surface is reachable from an appropriate low-clutter app location.
- [ ] A human reviews wording and placement before this slice is considered complete.

## Blocked by

- Blocked by Issue 1: Image Provenance Schema and Builder.

## User stories addressed

- User story 3
- User story 13
- User story 18

---

## Issue 5: Fallback and Provenance Regression Coverage

## Parent PRD

[Image Provenance PRD](./IMAGE_PROVENANCE_PRD.md)

## What to build

Close the feature with end-to-end regression coverage around the user-visible behavior and the provenance invariants. Branch images should continue to render normally, missing images should still use existing fallbacks, and provenance should stay attached across resolver updates.

This slice should verify the v1 promise: the image system still feels the same to users, but the underlying data is now governed and traceable.

## Acceptance criteria

- [ ] Existing node thumbnail fallback behavior still works when an image URL is absent.
- [ ] Existing node thumbnail fallback behavior still works when an image fails to load.
- [ ] Tree/profile surfaces continue to consume the existing display image URL without requiring image table joins.
- [ ] Resolver regression tests prove provenance is not silently dropped when entity display metadata is updated.
- [ ] Metadata preservation tests cover updates that change non-image entity fields.
- [ ] The provider attribution surface is covered by a simple test or route-level assertion where practical.
- [ ] Tests avoid brittle layout or animation assertions and focus on visible behavior and persisted invariants.
- [ ] The completed implementation does not introduce image uploads, local binary storage, CDN copies, or a normalized image table.

## Blocked by

- Blocked by Issue 2: Write Provenance During Entity Resolution.
- Blocked by Issue 4: Credits and Provider Attribution Surface.

## User stories addressed

- User story 1
- User story 2
- User story 4
- User story 9
- User story 10
- User story 16
- User story 18
