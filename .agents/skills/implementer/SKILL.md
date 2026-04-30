---
name: implementer
description: Implement GitHub issues labelled ready-for-agent by respecting blockers, using red-green-refactor principles, verifying changes, committing, and closing completed issues. Use when the user asks to implement ready issues, run the implementer, process issues once or in a loop, dry-run the implementation queue, or work a specific GitHub issue.
---

# Implementer

## Purpose

Use this skill as the implementation stage after `triage`. It turns `ready-for-agent` GitHub issues into verified commits.

The implementer can work a specific issue, pick the next unblocked issue, or loop through the queue until no runnable issues remain.

## Modes

- **batch-plan**: inspect the queue and report what would run next. Do not edit files, commit, or close issues.
- **once**: implement exactly one issue, then stop.
- **loop**: implement one unblocked issue at a time until no runnable issues remain.

If the user provides an issue number, work only that issue unless they explicitly ask for a loop starting from that issue.

If the user does not specify a mode, use `once`.

## Queue Refresh

At the start of every iteration, fetch fresh issue state:

```bash
gh issue list --state open --label ready-for-agent --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'
```

Also inspect recent implementation history:

```bash
git log --oneline --grep="IMPLEMENTER" -10
git log --oneline --grep="RALPH" -10
```

For a specific issue:

```bash
gh issue view <issue-number> --comments --json number,title,state,body,labels,comments
```

If the specific issue is closed, not labelled `ready-for-agent`, or still blocked, say why and stop without choosing another issue.

## Blocker Rules

Parse each issue body and comments for blockers written like `Blocked by #123`.

- An issue is runnable only when every referenced blocker issue is closed.
- A blocker is cleared when the referenced issue is closed.
- If a blocker reference cannot be checked, treat the issue as blocked and explain why.
- If choosing from the queue, skip blocked issues.
- Refresh GitHub after every issue is closed; do not rely on stale queue state.

Use `gh issue view <number> --json number,state,title` to check blocker state.

## Selection Rules

When no issue number is provided, choose the highest-priority runnable issue:

1. Bug fixes: broken behaviour affecting users
2. Tracer bullets: thin end-to-end slices that prove an approach works
3. Polish: improving existing functionality, UX, errors, or docs
4. Refactors: internal cleanups with no user-visible change

Prefer issues whose blockers were just cleared, because they are usually next in the planned slice sequence.

## Implementation Workflow

For each selected issue:

1. Explore: read the issue carefully. Pull in any referenced PRD or parent issue. Read `CONTEXT.md`, relevant ADRs, source files, and tests before editing.
2. Plan: decide what to change and why. Keep the change as small as possible.
3. Test discipline: for behavior changes, domain logic, server actions, UI flows, or bug fixes, use red-green-refactor principles directly. Treat the `ready-for-agent` issue body, comments, agent brief, acceptance criteria, and parent PRD as approval for the test plan; do not stop to ask for user approval unless the expected behavior or public interface is genuinely ambiguous.
4. Execute: when practical, add or update one failing behavior test first, then implement the smallest change to pass it. Repeat one behavior at a time. Skip test-first work for docs-only, config-only, or purely mechanical cleanup work.
5. Refactor: only refactor when green. Keep refactors local to the issue.
6. Verify: run `pnpm lint`. If the issue touches tested behaviour, also run the most relevant package tests, such as `pnpm --filter @repo/web test`, `pnpm --filter @repo/engine test`, or `pnpm --filter @repo/schemas test`.
7. Commit: make one git commit after verification passes.
8. Close: close the issue with `gh issue close <issue-number> --comment "Completed by Implementer: <brief summary>"`.

## Commit Format

The commit message must:

- Start with `IMPLEMENTER:`
- Include the issue number and task completed
- Include any PRD reference
- List key decisions made
- List files changed
- Note any blockers for the next iteration

## Stop Conditions

Stop immediately if:

- the selected issue is blocked
- required context is missing and cannot be inferred from the issue, parent PRD, codebase, or docs
- expected behavior or public interface is ambiguous enough that implementation would be guesswork
- verification fails and cannot be resolved in the current iteration
- the worktree contains conflicting user changes that make safe implementation unclear

In `loop` mode, continue until one of these happens:

- no open `ready-for-agent` issues exist
- all open `ready-for-agent` issues are blocked
- a selected issue cannot be completed safely

Only output the completion signal when no runnable issues remain:

```text
<promise>COMPLETE</promise>
```

## Batch Plan Output

In `batch-plan` mode, show:

- next runnable issue
- blocked issues and their open blockers
- closed blockers that have cleared work
- recommended mode to run next (`once` or `loop`)

Do not modify GitHub, files, or git history in `batch-plan` mode.
