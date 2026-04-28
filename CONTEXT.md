# Culture Tree Context

Culture Tree helps people grow curated maps of connected cultural references from a starting idea. This context defines the product language for trees, access, paid plans, and AI usage.

## Language

### Tree Structure

**Culture Tree**:
A curated map of connected cultural references grown from one starting idea.
_Avoid_: Graph, map, node tree

**Seed**:
The starting idea at the center of a Culture Tree.
_Avoid_: Root, root node

**Branch**:
Any item connected into the Culture Tree beneath the Seed or another Branch.
_Avoid_: Node, leaf

**Top-level Branch**:
A Branch connected directly to the Seed.
_Avoid_: First-level node

**Child Branch**:
A Branch connected beneath another Branch.
_Avoid_: Child node, subnode

**Leaf Branch**:
A Branch with no Child Branches.
_Avoid_: Node

**Subtree**:
A Branch together with all of its connected Child Branches.
_Avoid_: Branch descendants, node subtree

### Tree Actions

**Generate Tree**:
The action of creating a new Culture Tree from a Seed.
_Avoid_: Create graph, make node tree

**Grow Branch**:
The action of adding a new Branch to a Seed or another Branch with AI-generated connection context.
_Avoid_: Add node, append node, add branch

**Clone Tree**:
The action of copying an existing Culture Tree without asking the system to regenerate content.
_Avoid_: Remix, duplicate generation

**Remix Tree**:
The action of generating a new variation from an existing Culture Tree.
_Avoid_: Clone, copy

**Build From Scratch**:
The future paid action of manually choosing every element in a Culture Tree.
_Avoid_: Empty generated tree, remix

**Manual Branch Authoring**:
The future action of adding or editing a Branch without asking the system to generate connection context.
_Avoid_: Free grow, non-AI branch

**Delete Branch**:
The action of removing a Branch and its entire Subtree from a Culture Tree.
_Avoid_: Delete node, remove node

**Enrich**:
The action of attaching media, links, and reference metadata to a Culture Tree's Branches.
_Avoid_: Refresh node data, hydrate nodes

### Access and Ownership

**Owner**:
The signed-in person who can edit a Culture Tree.
_Avoid_: User, editor

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
The future paid action of discussing a Public Tree in the product.
_Avoid_: Notes, reviews

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
The number of generated Culture Trees a person may create under their Plan.
_Avoid_: Tree count, current trees

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

- A **Culture Tree** has exactly one **Seed**
- A **Culture Tree** has zero or more **Branches**
- A **Top-level Branch** belongs directly to one **Seed**
- A **Child Branch** belongs directly to one parent **Branch**
- A **Leaf Branch** has zero **Child Branches**
- Deleting a **Branch** removes its entire **Subtree**
- A **Public Tree** can be viewed by non-owners, but only the **Owner** can edit it
- An **Owner** can delete their own Culture Trees and Branches regardless of allowance state
- An **Owner** can make their own Culture Trees public or private regardless of Plan
- Public shared links can be viewed without signing in
- **Public Tree Browsing** is for signed-in people
- **Commenting** is a future paid community entitlement and is outside the first Pro foundation slice
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
- The **Free Plan** has lifetime AI Generation limits that are not reset by deleting Culture Trees or Branches
- The **Free Plan** allows three lifetime generated Culture Trees
- The **Free Plan** allows three Grow Branch actions per Culture Tree
- The Free Plan's per-tree Grow Branch allowance is attached to the Culture Tree artifact
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
- **Clone Tree** does not consume an **AI Generation**
- **Clone Tree** requires a paid Plan in the current product model
- **Remix Tree** consumes an **AI Generation**
- **Remix Tree** requires a paid Plan in the current product model
- **Build From Scratch** is a future paid entitlement and is outside the first Pro foundation slice
- **Manual Branch Authoring** does not exist in the current product model and should be treated as a later capability
- The **First Pro Foundation Slice** includes Plan Configuration, Effective Plan resolution, Usage History, database migration, server-side gates for Generate Tree and Grow Branch, a minimal Allowance Summary in settings, and focused enforcement tests
- The **First Pro Foundation Slice** does not include checkout, Stripe integration, Public Tree Browsing, Commenting, Build From Scratch, Clone Tree, or Remix Tree
- The first-slice **Allowance Gates** apply to direct Generate Tree, Generate Tree from a Branch, and Grow Branch
- The first-slice **Allowance Gates** do not apply to Retry Generation, visibility changes, deletion, search, or enrichment-only work
- First-slice usage accounting starts at rollout and does not backfill local development trees
- Local development cleanup is manual and outside the first Pro foundation slice
- The **First Pro Foundation Slice** does not include **Admin Tooling**
- The **Stripe Integration Slice** follows the **First Pro Foundation Slice**
- The **Stripe Integration Slice** connects real subscription state to Effective Plan resolution before user testing
- The **Stripe Integration Slice** should use the **Better Auth Stripe Integration** unless a blocker is discovered
- An **Allowance Gate** is the source of truth for whether an AI Generation may start
- **Limit Reached** should identify which allowance blocked the action
- The UI should explain allowance state, but the UI is not the source of truth for access
- The **Allowance Summary** lives in settings in the first Pro foundation slice
- The Free **Allowance Summary** shows the Free Plan, generated trees used, Grow Branch allowance per tree, and that deletion does not restore usage
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
> **Domain expert:** "Yes in the current product model, because the system generates the connection context. Fully manual branch authoring comes later."

## Flagged Ambiguities

- "node" was being used in the UI for the same concept as **Branch**. Resolution: keep "node" only in implementation code and use **Branch** in product language.
- "root" and **Seed** refer to the same central concept. Resolution: use **Seed** in product language and reserve "root" for internal technical discussions if needed.
- "Pro" was initially discussed as a boolean subscriber state. Resolution: use **Plan** and **Entitlement** language so **Patron** can inherit Pro-level access.
- Better Auth roles could be used for Pro and Patron. Resolution: Pro and Patron are **Plans**, while roles are reserved for administrative or organizational access control.
- Better Auth's Admin plugin could help with future **Admin Tooling**, but it is outside the first Pro foundation slice.
- "Unlimited" was used as shorthand for paid usage. Resolution: paid Plans have a generous **AI Generation Allowance**, not unbounded AI usage.
- "Credits" was considered for AI usage. Resolution: use **AI Generation Allowance** because people cannot buy extra credits in the current product model.
- "Grow Branch" sounded like provider search rather than AI generation. Resolution: current **Grow Branch** is AI-assisted because the system generates connection context after selection.
- "Three free generations" could mean three total AI Generations or separate tree and branch allowances. Resolution: the **Free Plan** has three lifetime generated Culture Trees and three Grow Branch actions per Culture Tree.
- Free branch usage could follow clone lineage or seed lineage. Resolution: the Free Plan's per-tree Grow Branch allowance is attached to the Culture Tree artifact.
- Paid allowances could be split by action type. Resolution: paid Plans use one shared recurring **AI Generation Allowance** to keep monetization simple.
- Plan allowances could live only in billing-provider configuration. Resolution: **Plan Configuration** is app-owned, while billing state determines which Plan applies.
- A person could theoretically have multiple valid billing records. Resolution: the product resolves one **Effective Plan**, choosing the highest valid Plan when necessary.
- Trial access could be withheld until first payment. Resolution: trialing subscriptions count as a **Valid Paid Plan**.
- Payment-trouble states could keep paid access during a grace period. Resolution: no grace period exists in the current product model.
- Tree generation from an existing Branch could be treated differently from generation from a typed Seed. Resolution: every **Generate Tree** action is counted the same way.
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
- Clone could be used as a free conversion loop from Public Tree Browsing. Resolution: **Clone Tree** is paid-only in the current product model.
- Remix could be treated as another Free Plan tree generation origin. Resolution: **Remix Tree** is paid-only in the current product model.
- "Build From Scratch" could mean an empty AI-assisted tree. Resolution: it means manually choosing every element and is deferred from the first Pro foundation slice.
- Commenting could be bundled into the first paid release. Resolution: **Commenting** is Pro-only but deferred from the first Pro foundation slice.
- The first paid-plan work could start with checkout. Resolution: the **First Pro Foundation Slice** proves entitlements and usage limits before checkout or new Pro features.
- Stripe could be included in the first paid-plan slice. Resolution: Stripe is deferred to a dedicated **Stripe Integration Slice** immediately after the foundation slice.
- Public Tree Browsing could be bundled into the first Pro foundation slice. Resolution: it is future discovery work and is outside the first slice.
- Allowance Gates could be added broadly around tree actions. Resolution: first-slice gates apply only to direct Generate Tree, Generate Tree from a Branch, and Grow Branch.
- Existing local development trees could be backfilled into Usage History. Resolution: skip backfill and start usage accounting at rollout.
- A local cleanup script could reset old trees and usage. Resolution: cleanup remains manual for now.
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
