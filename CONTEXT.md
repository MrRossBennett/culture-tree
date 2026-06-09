# Culture Tree Context

Culture Tree helps people grow curated maps of connected cultural references from a starting idea. This context defines the product language for trees, access, paid plans, and AI usage.

## Language

### Tree Structure

**Culture Tree**:
A curated collection of cultural references that expresses an Owner's taste, knowledge, or curiosity. A Culture Tree is often grown from a Seed, but a manually curated Culture Tree does not need a single starting idea.
_Avoid_: Graph, map, node tree

**Curatorial Intent**:
The Owner's reason for bringing a set of Branches together in a Culture Tree. Curatorial Intent may be expressed through the title, description, Seed, selected Branches, or optional notes, and does not require explicit Branch-to-Branch explanations.
_Avoid_: Edge rationale, connection map, graph logic

**Seed**:
The initial prompt, subject, or idea used to start a Culture Tree, especially when using AI. A Seed may express Curatorial Intent, but a manually authored Culture Tree can have no Seed.
_Avoid_: Root, root node

**Branch**:
A Recognized Cultural Subject included in a Culture Tree. A Branch must represent a work, person, group, place, movement, source, or other reference with enough cultural substance to be named and contextualized.
_Avoid_: Node, leaf

**Recognized Cultural Subject**:
A cultural subject that Culture Tree can identify through its own search, generation, enrichment, or other trusted cultural data path.
_Avoid_: Uploaded item, raw link, arbitrary media

**Guide Section**:
A named intent-based grouping, usually created by AI, that helps a person decide what kind of cultural path to follow next in a generated Culture Tree. Guide Sections are not required for manually curated Culture Trees.
_Avoid_: Category, genre bucket, graph cluster

**Default Guide Sections**:
The standard Guide Sections for a generated Culture Tree: Start Here, More Like This, Join The Dots, Go Sideways, and Go Deeper.
_Avoid_: Dynamic section set, media category list

**Branch Role**:
The practical job a Branch plays for a person exploring a Culture Tree, such as an essential next stop, a similar work, a direct context item, a sideways path, or a deeper recommendation.
_Avoid_: Connection type, genre, tag

**Default Branch Roles**:
The standard Branch Roles for a generated Culture Tree: Essential Next, Similar Appetite, Documented Context, Sideways Path, and Deep Cut.
_Avoid_: Section name, connection label, genre label

**Branch Type**:
The kind of cultural subject a Branch represents, such as film, book, album, artist, place, event, or article.
_Avoid_: Guide Section, category, curator group

**Consumable Work**:
A cultural artifact a person can directly watch, read, listen to, view, or otherwise experience.
_Avoid_: Content item, media asset

**Documented Connection**:
A connection supported by a direct reference, creator-cited influence, production history, real-world context, or other provenance stronger than interpretation alone.
_Avoid_: Vibe, loose association, clever link

### Tree Actions

**Start Tree**:
The action of creating a new Culture Tree, either from scratch or with AI assistance.
_Avoid_: Generate as the only creation path

**Generate Tree**:
The AI-assisted action of creating a new Culture Tree from a Seed.
_Avoid_: Create graph, make node tree

**Explore Branch**:
The action of using an existing Branch as the Seed for a new Culture Tree.
_Avoid_: Expand node, child tree, nested tree

**Grow Branch**:
An internal or legacy name for AI-assisted Branch suggestion. Grow Branch should not be presented as a separate user-facing action when the person is simply adding Branches to an existing Culture Tree.
_Avoid_: User-facing mode, append node, add child branch

**Clone Tree**:
The action of copying an existing Culture Tree without asking the system to regenerate content.
_Avoid_: Remix, duplicate generation

**Remix Tree**:
The action of generating a new variation from an existing Culture Tree.
_Avoid_: Clone, copy

**Build From Scratch**:
The action of creating a Culture Tree by manually choosing its Branches instead of starting with AI generation.
_Avoid_: Empty generated tree, remix

**Manual Branch Authoring**:
The action of adding or editing a Branch without asking the system to generate connection context.
_Avoid_: Free grow, non-AI branch

**Add to Tree**:
The user-facing action of adding one or more Recognized Cultural Subjects to a Culture Tree. Add to Tree can be done by manually selecting Branches, asking AI to suggest Branches, or combining both before confirmation.
_Avoid_: Save, pin, collect, upload, Grow Branch

**Branch Tray**:
The temporary set of proposed Branches a Curator has gathered before adding them to a Culture Tree. A Branch Tray can include manually selected Branches and AI-suggested Branches, but nothing becomes part of the Culture Tree until the Curator confirms the Add to Tree action. Branch descriptions are edited after Branches have been added to the Culture Tree, not as a shared Branch Tray note.
_Avoid_: Cart, queue, playlist, batch

**AI-assisted Add to Tree**:
The action of asking AI to suggest Branches into the same Branch Tray used for manual Add to Tree. AI-assisted Add to Tree is a shortcut for curator review, not a separate user-facing mode or final publishing path. Once confirmed into the Culture Tree, AI-suggested Branches should not be visually separated from manually selected Branches.
_Avoid_: Auto-grow, AI mode, autonomous tree editing

**Delete Branch**:
The action of removing a Branch from a Culture Tree.
_Avoid_: Delete node, remove node

**Enrich**:
The action of attaching media, links, and reference metadata to a Culture Tree's Branches.
_Avoid_: Refresh node data, hydrate nodes

### Access and Ownership

**Owner**:
The signed-in person who can edit a Culture Tree.
_Avoid_: User, editor

**Curator**:
The public product identity of a person whose taste is expressed through Culture Trees, Liked Branches, and lightweight social activity.
_Avoid_: Owner, account, influencer

**Public Tree**:
A Culture Tree that anyone with the link can view.
_Avoid_: Shared tree, open tree

**Private Tree**:
A Culture Tree that only its Owner can view.
_Avoid_: Hidden tree, locked tree

**Public Tree Browsing**:
The signed-in discovery experience for finding Public Trees beyond direct shared links.
_Avoid_: Public-tree access, explore

**Commenting**:
The deferred action of discussing a Public Tree in the product.
_Avoid_: Notes, reviews

**Follow Curator**:
The action of following an Owner whose Public Trees a person wants to keep seeing.
_Avoid_: Subscribe, friend

**Like Branch**:
The lightweight action of appreciating or saving interest in a Branch without starting a discussion.
_Avoid_: Comment, review

**Liked Branches**:
The automatic collection of Recognized Cultural Subjects a person has liked. Liked Branches are not a Culture Tree and do not express Curatorial Intent by themselves.
_Avoid_: Liked Tree, favorites tree

### Plans and Usage

**Plan**:
The product tier that determines a person's entitlements and AI Generation Allowance.
_Avoid_: Role, account type

**Role**:
An access-control label for administrative or organizational permissions.
_Avoid_: Plan, subscription tier

**Effective Plan**:
The single Plan currently used to determine a person's entitlements.
_Avoid_: Active plans, subscription set

**Valid Paid Plan**:
A paid Plan whose subscription is active or trialing.
_Avoid_: Paid account, good standing

**Free Plan**:
The default Plan with fixed lifetime AI Generation limits and limited creation features.
_Avoid_: Trial, unpaid Pro

**Pro Plan**:
The paid Plan that unlocks the core paid product and a recurring AI Generation Allowance.
_Avoid_: Premium, subscriber flag

**Patron Plan**:
A supporter-status Plan that includes Pro entitlements, a higher allowance, and recognition.
_Avoid_: Super Pro, enterprise

**Entitlement**:
A product permission granted by a Plan or manual support decision.
_Avoid_: Stripe status, feature flag

**Plan Configuration**:
The app-owned definition of each Plan's entitlements and allowances.
_Avoid_: Stripe plan, price config

**Manual Entitlement Override**:
A future support decision that grants a person entitlements beyond their Plan.
_Avoid_: Bonus credits, comped subscription

**Pro Allowlist**:
A temporary way to grant specific people a paid Effective Plan before checkout exists.
_Avoid_: Tester allowlist, plan override, admin app, comped subscription

**Usage Adjustment**:
A future support decision that offsets or restores allowance after an accepted AI Generation fails unfairly.
_Avoid_: Refund, credit purchase

**AI Generation**:
A cost-incurring action that asks the system to generate or extend Culture Tree content.
_Avoid_: Credit, token spend

**AI Generation Allowance**:
The number of AI Generations a person may use in a defined period.
_Avoid_: Credits, quota

**Tree Generation Allowance**:
The number of AI-assisted Generate Tree actions a person may use under their Plan.
_Avoid_: Tree count, current trees, tree creation limit

**Tree Creation Limit**:
The number of Culture Trees a person may create under their Plan, regardless of whether each Culture Tree starts from scratch or with AI.
_Avoid_: Generated tree allowance, current tree count

**Branch Generation Allowance**:
The number of Grow Branch actions a person may use for a Culture Tree under their Plan.
_Avoid_: Branch count, current branches

**Usage History**:
The durable record of AI Generations a person has already used.
_Avoid_: Current tree count, balance

**Usage Type**:
The kind of AI Generation recorded in Usage History.
_Avoid_: Event type, analytics event

**Retry Generation**:
The action of continuing or recovering a previously accepted AI Generation that did not finish cleanly.
_Avoid_: New generation, duplicate charge

**Billing Period**:
The subscription period during which a paid Plan's AI Generation Allowance applies.
_Avoid_: Calendar month, invoice month

**Allowance Period**:
The period against which paid AI Generation usage is counted.
_Avoid_: Calendar month, usage bucket

**First Pro Foundation Slice**:
The initial paid-plan groundwork that adds entitlements and usage limits before checkout or new Pro features.
_Avoid_: Stripe launch, full Pro release

**Stripe Integration Slice**:
The follow-on slice that connects real subscriptions to the entitlement model.
_Avoid_: First Pro foundation slice, full billing dashboard

**Better Auth Stripe Integration**:
The intended billing integration path for connecting Stripe subscriptions to Culture Tree Plans.
_Avoid_: Custom Stripe billing, direct Stripe gates

**Admin Tooling**:
The future internal capability for managing people, support decisions, and operational access.
_Avoid_: Plan, paid feature

**Allowance Gate**:
A server-side decision that allows or blocks an AI Generation based on entitlements and Usage History.
_Avoid_: UI lock, client check

**Limit Reached**:
The product state where an Allowance Gate blocks an AI Generation because the applicable allowance is exhausted.
_Avoid_: Generic error, failed generation

**Allowance Summary**:
The settings-page view of a person's Effective Plan and allowance usage.
_Avoid_: Billing dashboard, usage meter

**Upgrade Prompt**:
The product message shown when a Free Plan limit blocks or constrains a paid action.
_Avoid_: Checkout, pricing page

## Relationships

- A **Culture Tree** can have one **Seed**
- A **Culture Tree** has zero or more **Branches**
- A **Culture Tree** is held together by **Curatorial Intent**
- A **Culture Tree** can have zero or more **Guide Sections**
- A **Guide Section** groups Branches by exploration intent, not by artifact type
- A generated Culture Tree uses the **Default Guide Sections**
- A manually curated **Culture Tree** does not need **Guide Sections**
- **Branch Types** can be used as filters when looking at a Culture Tree
- **Branch Types** should not force Branches into authored groupings
- Explicit Branch-to-Branch connection explanations are optional and are not required for a valid Culture Tree
- **Join The Dots** may be omitted when there is not enough direct or documented context
- A **Branch** belongs to at most one primary **Guide Section**
- A **Branch** can have one primary **Branch Role**
- A **Branch Role** explains why the Branch is useful to explore next
- Every **Branch** needs a cultural subject, not just an uploaded media asset
- A manually authored **Branch** should come from a **Recognized Cultural Subject**
- Raw links, uploads, and arbitrary media are not **Branches** by themselves
- Specific published articles, interviews, essays, reviews, and criticism can be **Branches** when recognized as cultural subjects
- **Explore Branch** creates a new Culture Tree rather than nesting one Culture Tree inside another
- **Grow Branch** extends the current Culture Tree rather than creating a nested Child Branch
- **Grow Branch** is distinct from **Manual Branch Authoring**
- **Add to Tree** is the preferred UI language for **Manual Branch Authoring**
- Deleting a **Branch** removes it from its Culture Tree
- A **Consumable Work** should dominate recommendation-oriented Guide Sections
- A **Documented Connection** requires stronger provenance than an interpretive recommendation
- A **Public Tree** can be viewed by non-owners, but only the **Owner** can edit it
- A **Curator** can be followed through **Follow Curator**
- **Owner** is access-control language, while **Curator** is public product language
- An **Owner** can delete their own Culture Trees and Branches regardless of allowance state
- An **Owner** can make their own Culture Trees public or private regardless of Plan
- Public shared links can be viewed without signing in
- **Public Tree Browsing** is for signed-in people
- Public product discovery should center visible **Public Trees**, not AI generation alone
- **Commenting** is deferred and should not be treated as a core social action
- Social discovery should prioritize **Follow Curator**, **Like Branch**, and branch-level **Add to Tree** over comments
- Following is curator-centered; following individual Culture Trees is deferred
- **Liked Branches** are separate from **Culture Trees**
- **Liked Branches** do not count against the **Tree Creation Limit**
- **Liked Branches** can appear on a **Curator** profile but should be visually separate from authored Culture Trees
- A **Plan** grants one or more **Entitlements**
- A **Role** is not a **Plan**
- Pro and Patron should be represented as **Plans**, not auth roles
- A person has exactly one **Effective Plan** at a time
- If billing state contains multiple valid paid Plans, the highest valid Plan becomes the **Effective Plan**
- A paid Plan is valid when its subscription is active or trialing
- A person without a **Valid Paid Plan** has the **Free Plan** as their **Effective Plan**
- Payment-trouble states such as past due do not count as a **Valid Paid Plan** in the current product model
- A person has the **Pro Plan** when they have a valid Pro subscription or their email is on the **Pro Allowlist**
- **Plan Configuration** defines the default entitlements and allowances for each Plan
- The **Free Plan** has a lifetime **Tree Creation Limit** and lifetime AI Generation limits that are not reset by deleting Culture Trees or Branches
- The **Free Plan** allows three lifetime Culture Trees
- The **Free Plan** allows three Grow Branch actions per Culture Tree
- The Free Plan's per-tree Grow Branch allowance is attached to the Culture Tree artifact
- **Manual Branch Authoring** does not consume an **AI Generation**
- **Add to Tree** does not consume an **AI Generation**
- Every **Generate Tree** action counts against the applicable allowance regardless of where the Seed came from
- Paid Plans have one shared recurring **AI Generation Allowance** that follows the **Billing Period**
- Paid Plans do not sell extra AI Generations in the current product model
- The **Pro Plan** uses a configured paid AI Generation Allowance even before checkout exists
- The **Patron Plan** includes Pro entitlements but is primarily a supporter-status Plan
- The **Patron Plan** is future product language and is not implemented in the first Pro foundation slice
- **Manual Entitlement Overrides** are allowed by the domain model but are not part of the current product surface
- The **Pro Allowlist** grants the **Pro Plan** before checkout exists so specific people can exercise paid behavior
- The **Pro Allowlist** identifies people by email
- The **Pro Allowlist** may remain after checkout exists, but Stripe-backed subscription is the primary Pro access path
- **Usage Adjustments** are allowed by the domain model but are not part of the current product surface
- An **AI Generation** is counted in **Usage History** when the action is accepted and queued
- **Usage History** records allowance-consuming AI Generations, not every product action
- **Usage History** records the **Usage Type** for each AI Generation
- **Usage History** records the **Effective Plan** at the time of usage
- Paid usage in **Usage History** records the applicable **Allowance Period**
- Free usage in **Usage History** has no **Allowance Period**
- Generate Tree usage references the person and resulting Culture Tree artifact
- Grow Branch usage references the person and Culture Tree artifact it belongs to
- The first Pro foundation slice records Generate Tree and Grow Branch as the initial **Usage Types**
- **Usage History** survives Culture Tree deletion
- **Usage History** is deleted when the person it belongs to is deleted
- A **Retry Generation** does not consume another **AI Generation** when it is continuing the same accepted action
- **Generate Tree** and **Grow Branch** each consume one **AI Generation** in the current product model
- **Start Tree** does not necessarily consume an **AI Generation**
- **Clone Tree** does not consume an **AI Generation**
- **Clone Tree** requires a paid Plan in the current product model
- A person can use **Add to Tree** on individual Branches from a **Public Tree** without using **Clone Tree**
- **Remix Tree** consumes an **AI Generation**
- **Remix Tree** is deferred experimental product language and should not be treated as a core action
- **Build From Scratch** is a core signed-in action, not a paid-only entitlement
- **Manual Branch Authoring** is a core signed-in action, not a paid-only entitlement
- The **First Pro Foundation Slice** includes Plan Configuration, Effective Plan resolution, Usage History, database migration, server-side gates for Generate Tree and Grow Branch, a minimal Allowance Summary in settings, and focused enforcement tests
- The **First Pro Foundation Slice** does not include checkout, Stripe integration, Public Tree Browsing, Commenting, Build From Scratch, Clone Tree, or Remix Tree
- The first-slice **Allowance Gates** apply to direct Generate Tree, Generate Tree from a Branch, and Grow Branch
- The first-slice **Allowance Gates** do not apply to Retry Generation, visibility changes, deletion, search, or enrichment-only work
- First-slice usage accounting starts at rollout and does not backfill local development trees
- Local development cleanup is manual and outside the first Pro foundation slice
- Existing prototype Culture Trees do not constrain the curator-first product model
- The **First Pro Foundation Slice** does not include **Admin Tooling**
- The **Stripe Integration Slice** follows the **First Pro Foundation Slice**
- The **Stripe Integration Slice** connects real subscription state to Effective Plan resolution before user testing
- The **Stripe Integration Slice** should use the **Better Auth Stripe Integration** unless a blocker is discovered
- An **Allowance Gate** is the source of truth for whether an AI Generation may start
- **Limit Reached** should identify which allowance blocked the action
- The UI should explain allowance state, but the UI is not the source of truth for access
- The **Allowance Summary** lives in settings in the first Pro foundation slice
- The Free **Allowance Summary** shows the Free Plan, Culture Trees created, Grow Branch allowance per tree, and that deletion does not restore usage
- The Free **Allowance Summary** should lead with the Free Plan's **Tree Creation Limit** rather than exposing multiple AI counters as the primary message
- Persistent allowance counters should not appear throughout the main creation UI
- The main creation UI should show allowance messaging only when it affects the current action
- **Upgrade Prompts** may appear before checkout exists, but they should not imply payment is available

## Example Dialogue

> **Dev:** "If a free user deletes a **Culture Tree**, do they get one of their free **AI Generations** back?"
>
> **Domain expert:** "No. Deletion removes the tree artifact, but the **Usage History** still records that the generation was used."
>
> **Dev:** "Is **Patron** a higher-feature product than **Pro**?"
>
> **Domain expert:** "No. **Pro** is the paid product; **Patron** is Pro plus supporter recognition and a higher allowance."
>
> **Dev:** "Can someone who is not signed in view a **Public Tree**?"
>
> **Domain expert:** "Yes, direct public links are visible without signing in. **Public Tree Browsing** is the signed-in discovery experience."
>
> **Dev:** "Does **Grow Branch** consume an **AI Generation** if the user selects a search result?"
>
> **Domain expert:** "Only when the action is AI-assisted. Directly selecting a recognized cultural subject without AI help is **Manual Branch Authoring**."

## Flagged Ambiguities

- "node" was being used in the UI for the same concept as **Branch**. Resolution: keep "node" only in implementation code and use **Branch** in product language.
- "item" and "artifact" could replace **Branch** after demoting explicit graph structure. Resolution: keep **Branch** as the product term for a recognized cultural subject included in a Culture Tree.
- "collection" could replace **Culture Tree** after the curator-first shift. Resolution: keep **Culture Tree** as the first-class product term; explanatory copy may describe it as a curated collection.
- **Branch** could mean any saved media item. Resolution: a **Branch** must have a cultural subject, so unsourced media and generic visual inspiration are not valid Branches by themselves.
- A "works-only" model (2026-05-30) briefly made creators — **person** and **group/artist** — non-addable navigation-only subjects. Resolution (reversed 2026-05-31): creators are **first-class Branches**, both addable to a Culture Tree and expandable into their works, consistent with the **Branch** definition ("work, person, group, ...") and Trees like "film noir directors" or "British Invasion" that legitimately mix works and the people behind them. The Wikidata spine removes the original objection (messy person data) by giving creators clean canonical records.
- Manual authoring could allow arbitrary URL or media upload. Resolution: v1 **Manual Branch Authoring** uses **Recognized Cultural Subjects** rather than raw links or uploads.
- "root" and **Seed** refer to the same central concept. Resolution: use **Seed** in product language and reserve "root" for internal technical discussions if needed.
- A Culture Tree was previously assumed to require exactly one **Seed**. Resolution: a **Seed** is optional because manually curated Culture Trees can be valid without one clear starting idea.
- "Pro" was initially discussed as a boolean subscriber state. Resolution: use **Plan** and **Entitlement** language so **Patron** can inherit Pro-level access.
- Better Auth roles could be used for Pro and Patron. Resolution: Pro and Patron are **Plans**, while roles are reserved for administrative or organizational access control.
- Better Auth's Admin plugin could help with future **Admin Tooling**, but it is outside the first Pro foundation slice.
- "Unlimited" was used as shorthand for paid usage. Resolution: paid Plans have a generous **AI Generation Allowance**, not unbounded AI usage.
- "Credits" was considered for AI usage. Resolution: use **AI Generation Allowance** because people cannot buy extra credits in the current product model.
- "Grow Branch" sounded like provider search rather than AI generation. Resolution: **Grow Branch** is AI-assisted expansion, while direct search-and-add is **Manual Branch Authoring**.
- **Guide Sections** could be treated as universal Culture Tree structure. Resolution: they are AI guidance scaffolding for generated Culture Trees and are optional for manually curated Culture Trees.
- Manual and generated Culture Trees could use custom groupings as primary organization. Resolution: keep tree organization simple and use **Branch Types** as filters instead of mandatory groupings.
- Culture Trees could require explicit relationships between Branches. Resolution: a Culture Tree is held together by **Curatorial Intent**, and explicit Branch-to-Branch explanations are optional.
- "Three free generations" could mean three total AI Generations or separate tree and branch allowances. Resolution: the **Free Plan** has three lifetime Culture Trees and limited AI-assisted actions inside those trees.
- "Three free trees" could mean generated trees only or all tree creation. Resolution: the **Free Plan** has three lifetime Culture Trees regardless of whether each tree starts from scratch or with AI.
- Free branch usage could follow clone lineage or seed lineage. Resolution: the Free Plan's per-tree Grow Branch allowance is attached to the Culture Tree artifact.
- Paid allowances could be split by action type. Resolution: paid Plans use one shared recurring **AI Generation Allowance** to keep monetization simple.
- Plan allowances could live only in billing-provider configuration. Resolution: **Plan Configuration** is app-owned, while billing state determines which Plan applies.
- A person could theoretically have multiple valid billing records. Resolution: the product resolves one **Effective Plan**, choosing the highest valid Plan when necessary.
- Trial access could be withheld until first payment. Resolution: trialing subscriptions count as a **Valid Paid Plan**.
- Payment-trouble states could keep paid access during a grace period. Resolution: no grace period exists in the current product model.
- Tree generation from an existing Branch could be treated differently from generation from a typed Seed. Resolution: every **Generate Tree** action is counted the same way.
- Generate Tree could be treated as the only way to create a Culture Tree. Resolution: **Start Tree** is the broader creation action, and **Generate Tree** is only the AI-assisted path.
- Retry could consume another allowance unit. Resolution: **Retry Generation** continues the original accepted action and does not consume another **AI Generation**.
- Usage could be recorded only after successful delivery. Resolution: usage is recorded when an **AI Generation** is accepted and queued, because cost exposure begins there.
- Failed generations could automatically restore allowance. Resolution: allowance restoration is a future support-only **Usage Adjustment**, not a self-serve v1 behavior.
- Clone and remix could be treated as the same action. Resolution: **Clone Tree** copies existing content without AI, while **Remix Tree** generates a new variation and consumes an **AI Generation**.
- Usage History could become a full audit log. Resolution: **Usage History** records allowance-consuming AI Generations only in the first Pro foundation slice.
- Paid Plans use a shared allowance, but Usage History still needs action detail. Resolution: each record includes a **Usage Type**.
- Future AI actions could be pre-modeled as Usage Types. Resolution: the first slice only records Generate Tree and Grow Branch.
- Deleting a Culture Tree could remove its usage records. Resolution: **Usage History** survives deletion so allowances and analytics remain correct.
- Account deletion could preserve Usage History for analytics. Resolution: **Usage History** is deleted with the person it belongs to.
- Grow Branch usage could be tracked only at user level. Resolution: Grow Branch usage also references the Culture Tree artifact so per-tree Free Plan limits can be enforced.
- Generate Tree usage could model full origin lineage. Resolution: keep required usage references simple: person, Usage Type, and resulting Culture Tree artifact.
- Usage analytics could infer plan from current user state. Resolution: **Usage History** records the **Effective Plan** at the time of usage.
- Paid usage could be counted without storing its period. Resolution: paid **Usage History** records the applicable **Allowance Period**.
- Free usage could use a synthetic lifetime period. Resolution: Free usage has no **Allowance Period**.
- Exhausted allowance could block cleanup actions. Resolution: deletion remains available because it does not consume an **AI Generation**.
- Public/private visibility could be a paid entitlement. Resolution: Owners can change visibility regardless of Plan.
- "Owner" could be used for public identity. Resolution: use **Owner** for control and **Curator** for public product identity.
- Clone could be used as a free conversion loop from Public Tree Browsing. Resolution: **Clone Tree** is paid-only in the current product model.
- Public Tree Browsing could be blocked behind paid cloning. Resolution: keep **Clone Tree** paid-only, but allow branch-level **Add to Tree** from Public Trees.
- Remix could be treated as another Free Plan tree generation origin. Resolution: **Remix Tree** is deferred experimental product language.
- "Build From Scratch" could mean an empty AI-assisted tree. Resolution: it means manually choosing every element and is deferred from the first Pro foundation slice.
- **Build From Scratch** was previously treated as a future paid entitlement. Resolution: it is now a core signed-in action because manual curation is central to the product wedge.
- "Manual Branch Authoring" is too technical for interface copy. Resolution: use **Add to Tree** as the user-facing action.
- Commenting could be bundled into the first paid release. Resolution: **Commenting** is Pro-only but deferred from the first Pro foundation slice.
- Social discussion could become a product pillar. Resolution: avoid comments for now and prioritize lightweight Cosmos-style social actions.
- Following could apply to individual Culture Trees. Resolution: start with **Follow Curator** only.
- Likes could auto-create a giant **Culture Tree**. Resolution: likes belong to **Liked Branches**, an automatic collection separate from authored Culture Trees.
- The first paid-plan work could start with checkout. Resolution: the **First Pro Foundation Slice** proves entitlements and usage limits before checkout or new Pro features.
- Stripe could be included in the first paid-plan slice. Resolution: Stripe is deferred to a dedicated **Stripe Integration Slice** immediately after the foundation slice.
- Public Tree Browsing could be bundled into the first Pro foundation slice. Resolution: it is future discovery work and is outside the first slice.
- Allowance Gates could be added broadly around tree actions. Resolution: first-slice gates apply only to direct Generate Tree, Generate Tree from a Branch, and Grow Branch.
- Existing local development trees could be backfilled into Usage History. Resolution: skip backfill and start usage accounting at rollout.
- A local cleanup script could reset old trees and usage. Resolution: cleanup remains manual for now.
- Existing generated prototype trees could require backward-compatible support. Resolution: treat the platform as having no production trees yet; old prototype trees may be discarded, regenerated, or allowed to fail during the curator-first transition.
- The Allowance Summary could follow after enforcement. Resolution: a minimal **Allowance Summary** is part of the first Pro foundation slice.
- The Free Allowance Summary could list every tree's branch usage. Resolution: keep it minimal: plan, generated tree usage, per-tree Grow Branch allowance, and deletion note.
- Stripe could be integrated with custom billing code. Resolution: use the **Better Auth Stripe Integration** by default, while keeping product access behind app-owned entitlements.
- Testing paid Plans before checkout could require full admin tooling. Resolution: use a temporary **Pro Allowlist** before checkout exists.
- The **Pro Allowlist** could model multiple paid Plans. Resolution: it grants only the **Pro Plan** in the first Pro foundation slice.
- The **Pro Allowlist** could identify people by user ID. Resolution: use email for easier pre-checkout Pro access management.
- The **Pro Allowlist** could be deleted once checkout exists. Resolution: it may remain as a small internal escape hatch, while Stripe-backed subscription becomes the primary path.
- Effective Plan resolution could use precedence rules before Patron exists. Resolution: keep it simple: valid Pro subscription or **Pro Allowlist** means Pro; otherwise Free.
- The **Patron Plan** could be implemented alongside Pro. Resolution: Patron is documented as future product language but left out of the first Pro foundation slice.
- Tester Pro access could bypass limits entirely. Resolution: allowlisted Pro users use the configured paid **AI Generation Allowance**.
- Usage limits could be enforced only by disabling UI controls. Resolution: **Allowance Gates** enforce limits server-side, while the UI explains the state.
- Exhausted allowance could be returned as a generic error. Resolution: use a structured **Limit Reached** state so the UI can explain the block.
- Allowance counters could appear beside every AI action. Resolution: the first slice shows an **Allowance Summary** in settings instead.
- Pre-checkout limits could be a dead end. Resolution: use **Upgrade Prompts** that teach the paid boundary without implying checkout exists.
