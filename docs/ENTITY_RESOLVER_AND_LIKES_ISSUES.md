# Entity Resolver and Global Likes Issue Plan

Parent PRD: [Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

This issue plan breaks the PRD into independently grabbable tracer-bullet slices. The early slices establish the canonical entity spine, then later slices add source coverage, automatic resolution, likes, and profile surfaces.

## Proposed Breakdown

1. **Canonical Entity Spine**
   - **Type:** AFK
   - **Blocked by:** None
   - **User stories covered:** 10, 17, 18, 19, 20, 22

2. **Resolve Existing Search-Result Branches**
   - **Type:** AFK
   - **Blocked by:** Canonical Entity Spine
   - **User stories covered:** 10, 15, 19, 20, 22, 23

3. **Queue Automatic Per-Branch Resolution Jobs**
   - **Type:** AFK
   - **Blocked by:** Canonical Entity Spine
   - **User stories covered:** 14, 16, 20, 21, 23, 24

4. **TMDB Resolver for Film and TV**
   - **Type:** AFK
   - **Blocked by:** Canonical Entity Spine, Queue Automatic Per-Branch Resolution Jobs
   - **User stories covered:** 2, 8, 10, 19, 23, 24

5. **MusicBrainz Resolver for Music Entities**
   - **Type:** AFK
   - **Blocked by:** Canonical Entity Spine, Queue Automatic Per-Branch Resolution Jobs
   - **User stories covered:** 11, 12, 13, 19, 23, 24, 25

6. **Google Books and Wikipedia Resolver Coverage**
   - **Type:** AFK
   - **Blocked by:** Canonical Entity Spine, Queue Automatic Per-Branch Resolution Jobs
   - **User stories covered:** 8, 14, 16, 18, 19, 23, 24

7. **Expose Entity Resolution State to Tree Reads**
   - **Type:** AFK
   - **Blocked by:** Resolve Existing Search-Result Branches, TMDB Resolver for Film and TV
   - **User stories covered:** 4, 8, 9, 10, 15, 16

8. **Global Entity Like API**
   - **Type:** AFK
   - **Blocked by:** Expose Entity Resolution State to Tree Reads
   - **User stories covered:** 1, 2, 3, 4, 5, 19

9. **Tree Like UI for Resolved Branches**
   - **Type:** HITL
   - **Blocked by:** Global Entity Like API
   - **User stories covered:** 1, 2, 3, 4, 5, 8, 9

10. **Profile Liked Things List**
    - **Type:** HITL
    - **Blocked by:** Global Entity Like API
    - **User stories covered:** 6, 7

11. **Backfill Existing Trees**
    - **Type:** AFK
    - **Blocked by:** TMDB Resolver for Film and TV, MusicBrainz Resolver for Music Entities, Google Books and Wikipedia Resolver Coverage
    - **User stories covered:** 10, 14, 19, 21, 24

12. **Resolver Operations Hardening**
    - **Type:** AFK
    - **Blocked by:** Queue Automatic Per-Branch Resolution Jobs, MusicBrainz Resolver for Music Entities
    - **User stories covered:** 21, 23, 24, 25

---

## Issue 1: Canonical Entity Spine

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Create the canonical entity foundation that every later slice depends on. This should introduce the database model for Culture Tree entities, external identities, tree-item-to-entity links, and the first resolver service interface. It should prove that a tree item can be linked to one global entity and that repeated use of the same external identity reuses the same entity.

## Acceptance criteria

- [ ] Canonical entities can be created with type, display metadata, primary external identity provenance, timestamps, and future page-ready fields.
- [ ] External identities can be attached to entities with source, external type, external ID, and optional URL.
- [ ] The database prevents the same external identity tuple from belonging to multiple entities.
- [ ] A tree item can be linked to exactly one canonical entity for a given tree item ID.
- [ ] The resolver service exposes stable functions for upserting an entity from an external identity and linking a tree item to that entity.
- [ ] Tests prove exact external identity reuse, duplicate prevention, and tree-item linking behavior.

## Blocked by

None - can start immediately.

## User stories addressed

- User story 10
- User story 17
- User story 18
- User story 19
- User story 20
- User story 22

---

## Issue 2: Resolve Existing Search-Result Branches

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Connect the canonical entity spine to branches that already carry trusted external identity metadata from manual search-result selection. When a user adds a branch from a selected search result, the system should immediately create or reuse the canonical entity and link the tree item to it.

## Acceptance criteria

- [ ] Manual search-result branch creation reuses existing canonical entities when the same external identity already exists.
- [ ] Manual search-result branch creation creates a canonical entity when the external identity is new.
- [ ] Concept/freeform branches continue to be added without canonical entity links.
- [ ] Tree item links are idempotent if the same add flow is retried.
- [ ] Tests cover selected-result branches, concept branches, and repeated selected-result identity reuse.

## Blocked by

- Blocked by Issue 1: Canonical Entity Spine.

## User stories addressed

- User story 10
- User story 15
- User story 19
- User story 20
- User story 22
- User story 23

---

## Issue 3: Queue Automatic Per-Branch Resolution Jobs

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Add a lightweight, durable per-tree-item resolution job queue. Tree generation and branch addition should enqueue eligible unresolved items for asynchronous resolution without blocking the user-facing tree response.

## Acceptance criteria

- [ ] Resolution jobs are stored per tree item with item snapshot, status, attempts, error information, scheduling fields, and timestamps.
- [ ] The database prevents duplicate pending jobs for the same tree item.
- [ ] Tree generation enqueues eligible unresolved branches after the tree is saved.
- [ ] Manual branch addition enqueues eligible unresolved branches when no immediate entity link exists.
- [ ] Queue creation does not block tree creation or prevent unresolved branches from rendering.
- [ ] Tests prove job enqueue idempotency and that tree creation can complete without resolution.

## Blocked by

- Blocked by Issue 1: Canonical Entity Spine.

## User stories addressed

- User story 14
- User story 16
- User story 20
- User story 21
- User story 23
- User story 24

---

## Issue 4: TMDB Resolver for Film and TV

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Implement the primary-authority resolver path for film and TV entities using TMDB. The resolver should use existing identity/enrichment data when available, search TMDB conservatively when needed, create or reuse canonical entities, and link tree items to the resolved entity.

## Acceptance criteria

- [ ] Film branches resolve through TMDB movie identities.
- [ ] TV branches resolve through TMDB TV identities.
- [ ] Exact known TMDB identities are reused without creating duplicates.
- [ ] TMDB search results must pass conservative type/title/year confidence checks before entity creation.
- [ ] Ambiguous or weak matches are left unresolved and do not create entities.
- [ ] Resolver jobs for film/TV can complete, retry safely, or skip without duplicating links.
- [ ] Tests cover exact identity reuse, strong search match, ambiguous no-match, and duplicate prevention.

## Blocked by

- Blocked by Issue 1: Canonical Entity Spine.
- Blocked by Issue 3: Queue Automatic Per-Branch Resolution Jobs.

## User stories addressed

- User story 2
- User story 8
- User story 10
- User story 19
- User story 23
- User story 24

---

## Issue 5: MusicBrainz Resolver for Music Entities

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Add MusicBrainz as the primary authority for music-related entities. Artists should resolve to MusicBrainz artists, albums to release groups, and songs to recordings. MusicBrainz requires no API key for this implementation, but the resolver must respect MusicBrainz usage guidance through cached or deduplicated lookups, a meaningful `User-Agent`, and conservative request pacing.

## Acceptance criteria

- [ ] Artist branches resolve to MusicBrainz artist MBIDs.
- [ ] Album branches resolve to MusicBrainz release-group MBIDs.
- [ ] Song branches resolve to MusicBrainz recording MBIDs.
- [ ] MusicBrainz identities use source, external type, and MBID rather than overloaded IDs.
- [ ] MusicBrainz configuration does not require an API key.
- [ ] The resolver checks local identities and cached lookups before calling MusicBrainz.
- [ ] The MusicBrainz client sends a meaningful `User-Agent`.
- [ ] The MusicBrainz resolver leaves ambiguous or weak matches unresolved.
- [ ] Tests cover artist, album, song, ambiguous no-match, release-group granularity, and recording granularity.

## Blocked by

- Blocked by Issue 1: Canonical Entity Spine.
- Blocked by Issue 3: Queue Automatic Per-Branch Resolution Jobs.

## User stories addressed

- User story 11
- User story 12
- User story 13
- User story 19
- User story 23
- User story 24
- User story 25

---

## Issue 6: Google Books and Wikipedia Resolver Coverage

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Round out v1 resolver coverage for books and broad cultural entities. Books should use Google Books as the first-version primary authority. People, places, events, artworks, and articles should use Wikipedia fallback where confident.

## Acceptance criteria

- [ ] Book branches can resolve to Google Books volume identities when confidence is high.
- [ ] Person, place, event, artwork, and article branches can resolve to Wikipedia page identities when confidence is high.
- [ ] Type-specific primary authority rules prevent secondary-source creation for types with stronger primary authorities.
- [ ] Weak or ambiguous matches are left unresolved.
- [ ] Existing enrichment/cache behavior is reused where appropriate instead of duplicating external calls.
- [ ] Tests cover book resolution, Wikipedia fallback resolution, ambiguous no-match, and source-authority rules.

## Blocked by

- Blocked by Issue 1: Canonical Entity Spine.
- Blocked by Issue 3: Queue Automatic Per-Branch Resolution Jobs.

## User stories addressed

- User story 8
- User story 14
- User story 16
- User story 18
- User story 19
- User story 23
- User story 24

---

## Issue 7: Expose Entity Resolution State to Tree Reads

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Update tree reads so consumers can know which branch items are resolved to canonical entities, without exposing technical resolver state to end users. Tree responses should include enough resolved entity data for later like UI and counts, while unresolved branches should render normally with no special messaging.

## Acceptance criteria

- [ ] Tree read responses include resolved entity information for linked tree items.
- [ ] Tree read responses omit likeable entity data for unresolved tree items.
- [ ] Unresolved branches continue to render normally.
- [ ] No technical unresolved/resolving/failure language is introduced to user-facing tree UI.
- [ ] Existing tree access rules for private and public trees continue to apply.
- [ ] Tests cover resolved branches, unresolved branches, and public/private tree reads.

## Blocked by

- Blocked by Issue 2: Resolve Existing Search-Result Branches.
- Blocked by Issue 4: TMDB Resolver for Film and TV.

## User stories addressed

- User story 4
- User story 8
- User story 9
- User story 10
- User story 15
- User story 16

---

## Issue 8: Global Entity Like API

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Implement the server-side global like model for canonical entities. Users should be able to like and unlike an entity, query their like state, and retrieve global like counts. Likes should not store branch or tree provenance.

## Acceptance criteria

- [ ] A signed-in user can like a canonical entity.
- [ ] A signed-in user can unlike a canonical entity.
- [ ] Repeated like and unlike actions are idempotent from the user's perspective.
- [ ] A user can like a given entity only once.
- [ ] Like counts are global per entity.
- [ ] Like records do not store tree ID, item ID, branch reason, or branch placement.
- [ ] Server functions enforce authentication for mutation.
- [ ] Tests cover like, unlike, uniqueness, idempotency, counts, and unauthenticated mutation rejection.

## Blocked by

- Blocked by Issue 7: Expose Entity Resolution State to Tree Reads.

## User stories addressed

- User story 1
- User story 2
- User story 3
- User story 4
- User story 5
- User story 19

---

## Issue 9: Tree Like UI for Resolved Branches

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Add the first user-facing like affordance to tree branch UI. Resolved branches should show a heart/count interaction. Unresolved branches should show no like affordance and no resolver-state explanation.

## Acceptance criteria

- [ ] Resolved branches show a like/unlike control.
- [ ] Resolved branches show the user's current like state.
- [ ] Resolved branches show a global like count.
- [ ] Liking and unliking update the UI without changing branch placement or tree data.
- [ ] Unresolved branches show no like control.
- [ ] The UI contains no user-facing unresolved/resolving/failure messaging.
- [ ] The interaction works for public tree viewers where auth state permits liking.
- [ ] UI tests or component-level tests cover resolved and unresolved branch rendering.

## Blocked by

- Blocked by Issue 8: Global Entity Like API.

## User stories addressed

- User story 1
- User story 2
- User story 3
- User story 4
- User story 5
- User story 8
- User story 9

---

## Issue 10: Profile Liked Things List

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Add a public liked-things surface to user profiles. The list should show canonical entities the user has liked, not branch placements or tree-specific reasons.

## Acceptance criteria

- [ ] A user's profile can display their liked entities.
- [ ] The liked list shows canonical entity display metadata.
- [ ] The liked list does not show tree provenance or branch placement as part of the like model.
- [ ] The list orders likes predictably, with most recent first unless existing profile conventions suggest otherwise.
- [ ] Empty liked lists render gracefully.
- [ ] Tests cover liked-list data loading, empty state, and public profile access.

## Blocked by

- Blocked by Issue 8: Global Entity Like API.

## User stories addressed

- User story 6
- User story 7

---

## Issue 11: Backfill Existing Trees

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Provide a command or script that scans existing culture trees, creates missing per-tree-item resolution jobs, and processes or schedules them through the same resolver service used for new trees. This should let the canonical graph improve for old content without bespoke migration logic.

## Acceptance criteria

- [ ] Existing tree items can be scanned for missing entity links.
- [ ] Missing eligible items are enqueued through the standard resolution job path.
- [ ] The backfill command is safe to run more than once.
- [ ] Backfill uses the same resolver service and source-authority rules as new content.
- [ ] Backfill reports useful counts for scanned, enqueued, resolved, skipped, and failed items.
- [ ] Tests cover idempotent enqueueing and avoiding duplicate entity links.

## Blocked by

- Blocked by Issue 4: TMDB Resolver for Film and TV.
- Blocked by Issue 5: MusicBrainz Resolver for Music Entities.
- Blocked by Issue 6: Google Books and Wikipedia Resolver Coverage.

## User stories addressed

- User story 10
- User story 14
- User story 19
- User story 21
- User story 24

---

## Issue 12: Resolver Operations Hardening

## Parent PRD

[Entity Resolver and Global Likes PRD](./ENTITY_RESOLVER_AND_LIKES_PRD.md)

## What to build

Harden the resolver runner for real usage. Add source-aware batching, retries, retry delays, MusicBrainz pacing, cache observability, and safe failure behavior so resolver throughput does not harm page performance or third-party API relationships.

## Acceptance criteria

- [ ] Resolver jobs are processed in bounded batches.
- [ ] Failed jobs record errors and retry according to a bounded policy.
- [ ] MusicBrainz calls respect conservative request pacing without relying on an API key.
- [ ] Resolver processing checks caches before external calls.
- [ ] Re-running a job cannot duplicate entities, external identities, or tree-item links.
- [ ] Operational logging or result summaries make it possible to inspect resolver behavior locally.
- [ ] Tests cover retries, bounded batches, safe reprocessing, and source-specific pacing behavior.

## Blocked by

- Blocked by Issue 3: Queue Automatic Per-Branch Resolution Jobs.
- Blocked by Issue 5: MusicBrainz Resolver for Music Entities.

## User stories addressed

- User story 21
- User story 23
- User story 24
- User story 25
