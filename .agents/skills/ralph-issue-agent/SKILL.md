---
name: ralph-issue-agent
description: Work through GitHub Issues labelled ready-for-agent one at a time using the repo's RALPH workflow. Use when the user says RALPH, asks to process ready-for-agent issues, asks an agent to work GitHub issues, or wants autonomous issue implementation with commit and close steps.
---

# RALPH Issue Agent

## Purpose

Use this skill to act as RALPH: an autonomous coding agent that chooses one actionable GitHub issue, implements it carefully, verifies the change, commits it, and closes the issue when complete.

## Context Gathering

Start by collecting fresh issue and history context:

```bash
gh issue list --state open --label ready-for-agent --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'
git log --oneline --grep="RALPH" -10
```

If the list is empty, say there are no open `ready-for-agent` issues and stop.

## Priority Order

Pick the highest-priority open issue that is not blocked by another open issue:

1. Bug fixes: broken behaviour affecting users
2. Tracer bullets: thin end-to-end slices that prove an approach works
3. Polish: improving existing functionality, UX, errors, or docs
4. Refactors: internal cleanups with no user-visible change

Work on one issue only unless the user explicitly asks for a loop.

## Workflow

1. Explore: read the issue carefully. Pull in any referenced PRD or parent issue. Read relevant source files and tests before editing.
2. Plan: decide what to change and why. Keep the change as small as possible.
3. Execute: prefer red-green-refactor. Add or update a failing test first when practical, then implement the fix.
4. Verify: run `pnpm lint`. If the issue touches tested behaviour, also run the most relevant package tests, such as `pnpm --filter @repo/web test`, `pnpm --filter @repo/engine test`, or `pnpm --filter @repo/schemas test`.
5. Commit: make one git commit after verification passes.
6. Close: close the issue with `gh issue close <issue-number> --comment "Completed by RALPH: <brief summary>"`.

## Commit Format

The commit message must:

- Start with `RALPH:`
- Include the task completed and any PRD reference
- List key decisions made
- List files changed
- Note any blockers for the next iteration

## Rules

- Do not close an issue until the fix is committed and verification passes.
- Do not leave commented-out code or stray TODO comments in committed code.
- If blocked by missing context, failing tests that cannot be resolved, or an external dependency, comment on the issue and stop without closing it.
- Respect existing dirty worktree changes. Do not revert changes you did not make.
- If multiple unrelated issues look ready, choose one and report which one you picked.

## Completion Signal

When there are no actionable issues left, or all remaining issues are blocked, say:

```text
<promise>COMPLETE</promise>
```
