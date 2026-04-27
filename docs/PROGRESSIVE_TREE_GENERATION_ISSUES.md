# Progressive Tree Generation Issue Plan

Parent PRD: [Progressive Tree Generation PRD](./PROGRESSIVE_TREE_GENERATION_PRD.md)

This plan breaks the PRD into independently grabbable tracer-bullet slices. The issue numbers below are local identifiers, not GitHub issue numbers.

## Slice Overview

1. **Create Recoverable Generation Drafts**
   - Type: AFK
   - Blocked by: None
   - User stories covered: 1, 2, 3, 20, 29, 30, 31, 33

2. **Render In-Progress Trees on the Tree Route**
   - Type: AFK
   - Blocked by: Slice 1
   - User stories covered: 3, 4, 8, 14, 15, 23, 24, 27, 28, 33

3. **Run Multi-Pass Generation into a Durable Final Result**
   - Type: AFK
   - Blocked by: Slice 1
   - User stories covered: 5, 7, 29, 32, 33, 34, 35

4. **Reveal Validated Branches Progressively**
   - Type: AFK
   - Blocked by: Slice 2, Slice 3
   - User stories covered: 6, 7, 8, 9, 14, 24, 27, 29, 34, 35

5. **Enrich Branches as They Commit**
   - Type: AFK
   - Blocked by: Slice 4
   - User stories covered: 10, 11, 12, 13, 19, 27

6. **Unify Homepage and Item-Seeded Generation**
   - Type: AFK
   - Blocked by: Slice 1, Slice 2
   - User stories covered: 1, 2, 22, 31

7. **Add Retry, Resume, and Stale-Run Recovery**
   - Type: AFK
   - Blocked by: Slice 3, Slice 4, Slice 5
   - User stories covered: 16, 17, 18, 19, 20, 21, 32, 34

8. **Show Recoverable Drafts in the Tree List**
   - Type: AFK
   - Blocked by: Slice 1, Slice 7
   - User stories covered: 16, 17, 25, 26

9. **Progressive Generation Visual Polish Review**
   - Type: HITL
   - Blocked by: Slice 2, Slice 4, Slice 5, Slice 7
   - User stories covered: 4, 6, 8, 10, 15, 27

10. **Optional Active-Session Draft Streaming Spike**
    - Type: HITL
    - Blocked by: Slice 4, Slice 9
    - User stories covered: Future enhancement only; relates to PRD Further Notes

---

## Issue 1: Create Recoverable Generation Drafts

## Parent PRD

Progressive Tree Generation PRD

## What to build

Add the smallest durable lifecycle needed to create a tree row immediately and represent it as an in-progress generation draft. Starting generation should create a private tree with the seed query, generation settings, an empty canonical item list, generation status metadata, and a fresh run identifier. The start operation should return a tree identifier immediately without waiting for model generation.

This slice should establish the core lifecycle contract but does not need to run the model yet.

## Acceptance criteria

- [ ] A signed-in user can start a generation and receive a tree identifier immediately.
- [ ] The created tree has clean canonical tree data with the seed/root and no incomplete tree items.
- [ ] Generation metadata can represent queued/running/ready/failed-style states without polluting canonical tree data.
- [ ] Generation metadata includes enough information to support single-flight generation and later stale-run fencing.
- [ ] Starting generation validates user input and preserves the existing generation settings: query, depth, tone, and media filter.
- [ ] Tests verify that the returned tree exists before any final generated branches are available.
- [ ] Tests verify that incomplete generation metadata is stored separately from canonical tree items.

## Blocked by

None - can start immediately.

## User stories addressed

- User story 1
- User story 2
- User story 3
- User story 20
- User story 29
- User story 30
- User story 31
- User story 33

---

## Issue 2: Render In-Progress Trees on the Tree Route

## Parent PRD

Progressive Tree Generation PRD

## What to build

Update the tree route so it can render a tree whose generation is not complete. The page should show the seed/root immediately, show an honest progress stage while canonical branches are not ready, poll durable tree state every second while generation is non-terminal, and stop polling once the tree is ready or failed.

This slice should make in-progress trees demoable even before the generation runner exists.

## Acceptance criteria

- [ ] The tree route can load and render an in-progress tree with zero branches.
- [ ] The seed/root card appears immediately for an in-progress tree.
- [ ] The page shows a non-janky progress/loading area while generation is active.
- [ ] The route polls or revalidates durable state every second while generation is non-terminal.
- [ ] Polling stops when the tree reaches a terminal ready or failed state.
- [ ] Completed trees continue to render normally.
- [ ] Public/private authorization behavior remains consistent with existing visibility rules.
- [ ] Tests verify in-progress, ready, and failed loader/query shapes.

## Blocked by

- Blocked by Issue 1

## User stories addressed

- User story 3
- User story 4
- User story 8
- User story 14
- User story 15
- User story 23
- User story 24
- User story 27
- User story 28
- User story 33

---

## Issue 3: Run Multi-Pass Generation into a Durable Final Result

## Parent PRD

Progressive Tree Generation PRD

## What to build

Add the generation runner path that takes an in-progress tree, runs the existing multi-pass generation flow, validates the final culture tree, and stores the full validated result privately for later reveal. This slice should preserve the current curation quality while introducing run fencing so stale or duplicate runners cannot overwrite newer state.

This slice does not need to reveal branches into canonical tree data yet.

## Acceptance criteria

- [ ] A generation run can execute the existing multi-pass generation behavior for a draft tree.
- [ ] The full final result must validate before it is stored as a revealable generation result.
- [ ] Canonical tree items remain empty until a reveal step commits them.
- [ ] The runner records generation stage updates that the tree route can display.
- [ ] Runner writes are guarded by the active run identifier.
- [ ] If validation fails, generation moves to a recoverable failed state.
- [ ] Tests verify that stale run identifiers cannot update the tree.
- [ ] Tests verify that invalid final results do not enter canonical tree data.

## Blocked by

- Blocked by Issue 1

## User stories addressed

- User story 5
- User story 7
- User story 29
- User story 32
- User story 33
- User story 34
- User story 35

---

## Issue 4: Reveal Validated Branches Progressively

## Parent PRD

Progressive Tree Generation PRD

## What to build

Reveal branches from the stored validated final result into canonical tree data one at a time. The tree page should show stable branch loading cards and then display committed branch cards as durable polling observes each new item. The reveal should be deterministic and resumable from the stored final result.

## Acceptance criteria

- [ ] A validated final result can be committed into canonical tree data item by item.
- [ ] Each committed item is schema-valid at the time it appears in canonical tree data.
- [ ] The page shows stable loading/reveal states without dumping all branches at once.
- [ ] Refreshing during reveal preserves committed branches and shows a current loading state.
- [ ] The reveal can determine which final-result items remain uncommitted.
- [ ] Generation reaches ready when all final-result branches are committed.
- [ ] Tests verify progressive commit behavior from a stored final result.
- [ ] Tests verify canonical tree validity after each branch commit.

## Blocked by

- Blocked by Issue 2
- Blocked by Issue 3

## User stories addressed

- User story 6
- User story 7
- User story 8
- User story 9
- User story 14
- User story 24
- User story 27
- User story 29
- User story 34
- User story 35

---

## Issue 5: Enrich Branches as They Commit

## Parent PRD

Progressive Tree Generation PRD

## What to build

Start media enrichment and entity resolution for each branch as soon as that branch is committed. The tree should remain valid and usable if enrichment is missing or partially fails. The UI should show branch content first, then let thumbnails, links, entity stats, and likes appear as enrichment/resolution data becomes available.

## Acceptance criteria

- [ ] Each newly committed branch triggers enrichment without waiting for the entire reveal to finish.
- [ ] Entity resolution is kicked for committed branches with enrichment when available.
- [ ] Enrichment failure does not mark generation as failed.
- [ ] Missing enrichment falls back to existing card visuals.
- [ ] The tree page shows enrichment loading/arrival without disrupting committed branch content.
- [ ] Ready trees with partial enrichment remain usable.
- [ ] Tests verify per-item enrichment trigger behavior.
- [ ] Tests verify enrichment failure is separate from generation failure.

## Blocked by

- Blocked by Issue 4

## User stories addressed

- User story 10
- User story 11
- User story 12
- User story 13
- User story 19
- User story 27

---

## Issue 6: Unify Homepage and Item-Seeded Generation

## Parent PRD

Progressive Tree Generation PRD

## What to build

Route both entry points for tree creation through the same progressive generation start operation. The homepage submit should create a draft tree and navigate immediately. The "generate new tree from this item" action should do the same, using the selected item to derive the query and generation settings.

## Acceptance criteria

- [ ] Homepage generation no longer waits for the full tree before navigation.
- [ ] The homepage navigates to the new tree route immediately after receiving a tree identifier.
- [ ] "Generate new tree from this item" uses the same progressive start path.
- [ ] Both entry points preserve media filter behavior.
- [ ] Both entry points handle start errors with clear user feedback.
- [ ] Existing generated trees still appear in the user's tree list after completion.
- [ ] Tests verify both entry points call the shared start behavior.

## Blocked by

- Blocked by Issue 1
- Blocked by Issue 2

## User stories addressed

- User story 1
- User story 2
- User story 22
- User story 31

---

## Issue 7: Add Retry, Resume, and Stale-Run Recovery

## Parent PRD

Progressive Tree Generation PRD

## What to build

Add a single user-facing retry action that chooses the least destructive backend recovery path. If no final result exists, retry should rerun generation on the same tree when safe. If a final result exists, retry should resume reveal. If the tree is ready but enrichment is incomplete, retry should rerun enrichment/resolution only. A run should become stale after five minutes without progress updates.

## Acceptance criteria

- [ ] Failed generation before final result can be retried on the same tree.
- [ ] Interrupted reveal can resume from the stored final result.
- [ ] Ready trees with missing enrichment can retry enrichment without regenerating.
- [ ] A fresh active run blocks duplicate retry/start attempts.
- [ ] A run with no progress update for five minutes is considered stale and can be taken over.
- [ ] Old runners cannot write after a newer run starts.
- [ ] Failed tree pages show a calm recoverable state with a retry action.
- [ ] Tests cover retry before final result, retry during reveal, retry enrichment, active-run blocking, stale-run takeover, and stale-run fencing.

## Blocked by

- Blocked by Issue 3
- Blocked by Issue 4
- Blocked by Issue 5

## User stories addressed

- User story 16
- User story 17
- User story 18
- User story 19
- User story 20
- User story 21
- User story 32
- User story 34

---

## Issue 8: Show Recoverable Drafts in the Tree List

## Parent PRD

Progressive Tree Generation PRD

## What to build

Update the user's tree list so failed or in-progress generation drafts are visible and understandable. Ready trees should continue to show normal list metadata. Drafts should show the original seed query, a stopped/in-progress state, and enough information for the user to open the tree page and recover rather than feeling that a seed disappeared.

## Acceptance criteria

- [ ] In-progress trees can appear in the user's tree list.
- [ ] Failed draft trees can appear in the user's tree list.
- [ ] Ready trees continue to show correct title, node count, date, and visibility.
- [ ] Draft entries use the seed query when no generated seed title exists.
- [ ] Draft entries distinguish in-progress, stopped, and ready states.
- [ ] Clicking a draft opens the recoverable tree page.
- [ ] Tests verify list formatting for ready trees, in-progress drafts, and failed drafts.

## Blocked by

- Blocked by Issue 1
- Blocked by Issue 7

## User stories addressed

- User story 16
- User story 17
- User story 25
- User story 26

---

## Issue 9: Progressive Generation Visual Polish Review

## Parent PRD

Progressive Tree Generation PRD

## What to build

Review and refine the progressive generation experience as a product interaction. This slice should focus on visual smoothness, copy, card stability, branch reveal pacing, enrichment transitions, and failure-state tone after the functional pipeline is working end to end.

This is marked HITL because it benefits from human design review in the running app.

## Acceptance criteria

- [ ] The seed/root is visually clear as the first stable anchor of the page.
- [ ] Planning/refinement progress feels honest and intentional, not technical or noisy.
- [ ] Loading branch cards reserve stable dimensions and do not cause layout jumps.
- [ ] Branch reveal pacing is legible but not sluggish.
- [ ] Enrichment transitions feel additive and do not obscure readable branch content.
- [ ] Failure and retry states use calm, non-technical language.
- [ ] Desktop and mobile layouts are reviewed in browser.
- [ ] Any polish changes preserve completed-tree behavior.

## Blocked by

- Blocked by Issue 2
- Blocked by Issue 4
- Blocked by Issue 5
- Blocked by Issue 7

## User stories addressed

- User story 4
- User story 6
- User story 8
- User story 10
- User story 15
- User story 27

---

## Issue 10: Optional Active-Session Draft Streaming Spike

## Parent PRD

Progressive Tree Generation PRD

## What to build

Investigate and prototype whether AI SDK streaming/SSE should add live-only draft branch fields for the active browser session. This should not replace durable polling or canonical validated branch commits. The spike should answer whether draft streaming is worth adding after the durable pipeline is stable.

This is marked HITL because the team should review the added complexity against the actual UX gain.

## Acceptance criteria

- [ ] The spike identifies the right streaming transport for the app's TanStack Start setup.
- [ ] The spike demonstrates or rejects active-session branch draft events.
- [ ] Draft fields remain live-only and are not persisted into canonical tree data.
- [ ] Refresh/rejoin behavior still depends on durable DB state.
- [ ] The spike documents complexity, deployment constraints, and recommendation.
- [ ] No production path depends on draft streaming unless explicitly accepted after review.

## Blocked by

- Blocked by Issue 4
- Blocked by Issue 9

## User stories addressed

- Future enhancement only.
- Related to the PRD's Further Notes on active-session AI SDK streaming.
