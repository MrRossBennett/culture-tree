# Creators are first-class Branches

Creators — **person** and **group/artist** — are addable Branches in a Culture Tree, both addable _and_ expandable into their works. This reverses the short-lived "works-only" model (2026-05-30), in which creators were a non-addable navigation layer only.

## Context

The works-only model held that "the constraint is the feature": forcing a list of _Britpop albums_ (rather than _Britpop bands_) makes Culture Trees specific and cross-medium. Its other motivation was technical — "people are where the messy Wikipedia data lives." Both the `CONTEXT.md` glossary (a **Branch** may be a "work, **person**, **group**, place, movement, …") and ADR 0004's own example Trees ("film noir directors") already implied creators should be Branches, so the works-only model conflicted with the documented language.

The Wikidata spine (ADR 0004) removed the technical objection: a creator now has a clean canonical record — QID, sitelink-count notability, `P18` portrait, dates — identical in quality to a work record. With the data objection gone, only the curatorial-purity argument remained, and it does not survive a concrete case: a Tree titled "British Invasion" legitimately wants _Rubber Soul_ and _A Hard Day's Night_ **and** The Beatles **and** Brian Epstein (a figure with no addable "work"). The product must allow that; the Branch Type filter keeps such a Tree navigable.

## Decision

- Creators are addable Branches. A creator search result is **both** addable (stage it like any Branch) and expandable (reveal its works via specialist expansion — ADR 0004).
- The `kind` discriminant (`addable-work` | `expandable-subject`) no longer gates addability. Every classified search result is addable; `kind` now only signals whether a result is _additionally_ expandable. The data-layer guard that rejected subjects (`branchTrayUnavailableReason` → `not-addable`) is removed.
- This is capability, not obligation: a curator likely won't mix a band with its own albums in one Tree, but the product must let them.

## Consequences

- AI generation is unchanged: it still emits works only (the `SYSTEM_PROMPT` "Nodes are WORKS" rule stands). Whether the AI should _volunteer_ creators is a separate, deferred question. Creators enter Trees through manual Add to Tree.
- `person` and `artist` remain ordinary `NodeType`s; minting a creator entity goes through the same Wikidata find-or-mint path as any work, with a `P18` portrait as its image.
- Supersedes the works-only decision recorded in the `search-works-only-architecture` memory and the soft-removal notes in `packages/engine`/`apps/web`.
