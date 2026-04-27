# Progressive Tree Generation PRD

## Problem Statement

Tree generation currently blocks the user on the homepage. After a user submits a seed, the only visible feedback is a loader inside the "Plant seed" button while the application waits for the full culture tree, enrichment, and entity resolution flow to complete. This is not a good enough experience because generation can take a long time, and the user has no meaningful sense that the tree is being thoughtfully created.

The product needs to move the user immediately into the tree experience, show the seed/root straight away, and make the waiting period feel worthwhile without faking generated content or compromising data quality. The core goal is clean, reliable data creation on the server while giving the user a beautiful, honest, progressive view of the tree becoming available.

## Solution

Create a progressive tree generation system that starts by creating a durable tree row immediately, returns a `treeId`, and navigates the user to the tree route right away. The tree route becomes the generation surface: it shows the seed/root immediately, displays real generation stage progress while the model performs the existing multi-pass curation, reveals schema-valid branches one by one after the final tree has validated, and starts enrichment for each branch as soon as that branch is committed.

The first implementation should prioritize the durable generation pipeline over live draft streaming. It should not fake branch content. During planning and refinement, the UI should show tasteful stage progress and stable loading branch cards. After the final validated tree exists, the server should progressively commit branches from that validated result, with a short intentional stagger so the reveal is legible rather than jarring. Each committed branch should then begin media enrichment and entity resolution independently.

The system should support both homepage generation and "generate new tree from this item" through the same progressive creation flow. It should also avoid duplicate or broken tree clutter by making generation single-flight per tree, recoverable, and retryable. A failed generation row should remain visible as a recoverable draft rather than disappearing.

## User Stories

1. As a signed-in user, I want to submit a seed and leave the homepage immediately, so that I do not feel stuck waiting on a button loader.
2. As a signed-in user, I want to land on the tree page as soon as generation starts, so that the tree has a clear place to grow.
3. As a signed-in user, I want to see my seed/root immediately, so that I know the app understood what I planted.
4. As a signed-in user, I want to see honest generation stages while the model is working, so that the wait feels intentional rather than frozen.
5. As a signed-in user, I want the app to preserve high-quality multi-pass curation, so that progressive UX does not make the resulting tree worse.
6. As a signed-in user, I want branch cards to appear progressively, so that I can watch the tree take shape instead of receiving a sudden finished dump.
7. As a signed-in user, I want branch content to appear only when it is real, so that I can trust what I am seeing.
8. As a signed-in user, I want loading branch cards to reserve stable space, so that the page does not jump around while the tree grows.
9. As a signed-in user, I want each revealed branch to include useful basic information, so that I can begin reading the tree before all enrichment is finished.
10. As a signed-in user, I want cover art and external media to fade in as they become available, so that enrichment feels like the tree coming into focus.
11. As a signed-in user, I want enrichment to begin for each branch as soon as that branch is committed, so that early branches can become rich while later branches are still appearing.
12. As a signed-in user, I want missing enrichment to degrade gracefully, so that a valid tree is not treated as failed just because a cover or link could not be found.
13. As a signed-in user, I want entity resolution and social stats to appear when available, so that branch cards become more useful over time.
14. As a signed-in user, I want refreshes during generation to keep completed progress, so that I do not lose the tree just because I navigated away or reloaded.
15. As a signed-in user, I want refreshes during generation to show a current loading state rather than stale half-written draft text, so that the page remains trustworthy.
16. As a signed-in user, I want failed generation to leave me on a recoverable tree page, so that I understand what happened and can try again.
17. As a signed-in user, I want retry to reuse the existing failed tree when safe, so that my account does not fill with duplicate broken trees.
18. As a signed-in user, I want retry to resume reveal when a final validated result already exists, so that the app does not pay unnecessary model cost or lose valid work.
19. As a signed-in user, I want retry enrichment to be separate from retry generation, so that a good tree is not regenerated just because media lookup failed.
20. As a signed-in user, I want generation to be protected from double-submits, so that I do not accidentally create duplicate trees.
21. As a signed-in user, I want stale generation to become retryable after a reasonable timeout, so that a crashed process does not leave a tree stuck forever.
22. As a signed-in user, I want the "generate new tree from this item" action to use the same progressive experience, so that all tree creation feels consistent.
23. As a signed-in user, I want the tree route to stop polling when generation is complete, so that the page does not keep doing unnecessary work.
24. As a signed-in user, I want the tree route to poll while generation is active, so that completed durable progress appears even without a live stream.
25. As a signed-in user, I want failed drafts to be visible in my tree list with a recoverable state, so that the app does not feel like it swallowed my seed.
26. As a signed-in user, I want tree list entries to distinguish ready trees from stopped drafts, so that I know which trees need attention.
27. As a signed-in user, I want a completed progressive tree to behave exactly like a normal tree, so that the progress experience disappears when it is no longer needed.
28. As a visitor viewing a public tree, I want ready trees to load normally, so that progressive generation internals do not leak into completed public viewing.
29. As a developer, I want canonical tree data to contain only schema-valid tree items, so that downstream rendering, enrichment, and entity resolution can trust the data.
30. As a developer, I want in-progress generation metadata to be separate from canonical tree data, so that incomplete drafts do not pollute the domain model.
31. As a developer, I want a single shared start-generation interface, so that homepage generation and item-seeded generation do not drift into separate flows.
32. As a developer, I want generation writes fenced by a run identifier, so that stale workers cannot overwrite newer retries.
33. As a developer, I want clear terminal and non-terminal generation states, so that polling, retry, and UI rendering can be simple.
34. As a developer, I want the final multi-pass result stored privately during reveal, so that interrupted reveals can resume without regenerating.
35. As a developer, I want branch reveal to be deterministic from a validated final result, so that progressive UI does not compromise curation quality.

## Implementation Decisions

- The existing blocking generation operation will be replaced or wrapped by a start-generation operation that returns a tree identifier immediately.
- Homepage generation and "generate new tree from this item" will both call the same progressive start-generation operation.
- The initial start-generation operation will create a durable tree row with seed query, generation settings, owner, visibility, and generation metadata.
- The tree route will become the primary progress surface and should be able to render a tree whose canonical item list is initially empty.
- Canonical tree data must remain clean: only complete, schema-valid tree items may be committed into the canonical tree item list.
- Incomplete draft fields should not be persisted as canonical tree data.
- Draft streaming is out of the first implementation. The first implementation will use durable stage updates, validated branch reveal, and polling.
- Future draft streaming may be added as an active-session enhancement using AI SDK streaming/SSE, but durable DB state must remain the fallback and source of truth.
- The current multi-pass curation behavior must be preserved. The system should not switch to one independent model call per branch for the first version.
- During planning and refinement, the UI should show the seed/root plus honest stage progress rather than fake branches.
- After the final multi-pass result validates, the server should progressively commit items from the validated result into canonical tree data.
- The server may intentionally stagger branch commits by a small amount so the reveal is visually legible.
- Enrichment should start for each branch as soon as that branch is committed.
- Entity resolution should be kicked for committed branches as enrichment becomes available, with graceful fallback when enrichment is missing.
- Generation failure and enrichment failure are separate concerns. Generation failure can stop the tree; enrichment failure should not invalidate an otherwise valid tree.
- Failed generation rows should remain visible as recoverable drafts rather than being hidden or deleted automatically.
- Retry should be a single user-facing action, with backend behavior chosen based on current state.
- If no final validated result exists, retry reruns generation on the same tree when safe.
- If a final validated result exists but reveal did not finish, retry resumes reveal from that result.
- If the tree is ready but enrichment is incomplete or failed, retry reruns enrichment/resolution for missing branches rather than regenerating the tree.
- Generation should be single-flight per tree. A second generation run must not start while an existing run is active and fresh.
- A running generation becomes stale after five minutes without a generation progress update.
- Generation writes should be fenced by a generation run identifier so stale workers cannot overwrite a newer run.
- The tree route should poll durable generation state at a simple one-second cadence while generation is non-terminal.
- Polling should stop when generation reaches a terminal ready or failed state.
- Public viewing should continue to respect existing visibility rules. In-progress private trees should not become public unless explicitly made public by the owner.
- Completed progressive trees should collapse into the same normal tree experience used by existing trees.
- Tree list entries should support draft/stopped states in addition to ready trees.

## Testing Decisions

- Good tests should validate external behavior and data lifecycle outcomes rather than implementation details such as exact timer durations or internal function calls.
- Tests should assert that starting generation creates a tree row immediately and returns a tree identifier before the final tree is available.
- Tests should assert that canonical tree data is valid at each persisted checkpoint.
- Tests should assert that incomplete progress metadata never appears inside the canonical tree item list.
- Tests should assert that a validated final result can be revealed item by item into canonical tree data.
- Tests should assert that enrichment can be triggered per committed item and that enrichment failure does not mark tree generation as failed.
- Tests should assert retry behavior for at least three states: failed before final result, interrupted after final result, and ready with missing enrichment.
- Tests should assert single-flight behavior when start or retry is called while a generation run is already active.
- Tests should assert stale-run takeover after the five-minute timeout.
- Tests should assert stale-run fencing by verifying that an old run identifier cannot write after a newer retry has begun.
- Tests should assert that tree list data can represent ready trees and recoverable failed drafts.
- Tests should assert that the tree route loader/query shape can represent in-progress, ready, and failed states.
- Existing generation pipeline tests provide prior art for engine-level generation behavior.
- Existing server tests around culture tree node creation and external node normalization provide prior art for validating server-side data transformations.
- UI tests should focus on visible states: immediate seed display, progress state, branch reveal, enrichment loading, ready state, and failed recoverable state.
- UI timing tests should avoid brittle exact animation assertions. They should verify stable content and state transitions instead.

## Out of Scope

- Active-session draft field streaming is out of scope for the first implementation.
- Persisting half-written branch names, reasons, or streamed draft fields is out of scope.
- Replacing the multi-pass generation strategy with independent per-branch model calls is out of scope.
- WebSocket infrastructure is out of scope.
- A full job queue or external worker platform is out of scope unless required by deployment constraints discovered during implementation.
- Automatic deletion of old failed drafts is out of scope for the first implementation.
- Advanced per-item retry controls are out of scope; retry should remain a simple user-facing action.
- Public collaborative viewing of in-progress private trees is out of scope.
- Major visual redesign of completed tree cards is out of scope, except for adding progress, loading, and enrichment states needed by this feature.

## Further Notes

The first implementation should be optimized for reliability and trust. The user experience should feel alive, but not at the cost of showing unstable or unvalidated data as if it were final. The product promise is not "instant tree"; it is "your tree is being thoughtfully grown, and you can watch real progress happen."

AI SDK streaming remains useful for a later enhancement. Once the durable lifecycle is proven, the active browser session can receive custom streaming events for branch-start, draft fields, commit, and enrichment updates. That should remain additive: refresh/rejoin behavior should still be powered by durable persisted state.

The central engineering module should be a small generation lifecycle layer with a simple interface for starting, retrying, revealing, and enriching a tree. That module should encapsulate run fencing, stale detection, status transitions, final-result storage, branch commits, and recovery behavior so UI and server functions do not duplicate lifecycle rules.
