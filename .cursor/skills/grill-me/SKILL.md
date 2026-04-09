---
name: grill-me
description: Interviews the user with focused questions about a plan, design, or architecture until ambiguities are resolved; walks the decision tree branch-by-branch with a recommended answer per question. Use when the user asks to be grilled, stress-test a plan, challenge a design, review an RFC, or mentions "grill me".
---

# Grill Me

## Goal

Drive toward shared understanding by surfacing unstated assumptions, ordering dependent decisions, and closing each branch before moving on.

## How to run the session

1. **Clarify scope** in one sentence: what artifact (feature, migration, API change, etc.) is being stress-tested.
2. **Order questions by dependency** — resolve prerequisites (data model, ownership, failure modes) before UI or implementation details that assume them.
3. **One branch at a time** — don’t parallelize unrelated threads; finish or park a branch explicitly.
4. **Per question**: ask clearly, then give a **recommended answer** with a short rationale. Invite correction; if the user disagrees, update the shared picture and continue.
5. **Codebase first** — if the answer is knowable from the repo (existing patterns, types, flags, similar features), read/search the codebase and state findings before asking the user to invent policy.

## Stopping

Pause grilling when the user says they’re satisfied, or when major branches are resolved and only nitpicks remain (offer to continue or wrap with a short decision summary).

## Output shape (lightweight)

- Optional bullet **Decisions so far** when the thread gets long.
- Final **Summary**: decisions + open risks if any.
