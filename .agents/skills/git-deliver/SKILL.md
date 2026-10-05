---
name: git-deliver
description: "Commit and push scoped local work, optionally merge into its parent branch and push that branch, with multi-agent worktree checks and guided handling of ambiguous changes."
category: software-engineering
disable-model-invocation: true
---

# Git Deliver

## Purpose

Deliver one task from its current worktree to a named remote branch. Optionally integrate it into the intended parent branch. Explain decisions in the user's language, using file groups and concrete consequences instead of requiring Git expertise.

## Prerequisites

- Git CLI with `worktree`, `switch`, and porcelain status support; a local repository and shell access. Run `git --version` before relying on optional flags.
- Repository read access for audit; write access and configured commit identity for delivery. Respect configured hooks and signing; their tools and keys must be available if required.
- A configured remote, network access, and credentials with permission to push the selected branches. Audit works offline, with remote freshness marked unknown.
- The project's documented validation tools for the affected changes. Report missing tools rather than installing or bypassing them silently.
- Optional: the hosting provider's CLI/API and account permissions when repository rules require pull requests.

## Commands

Default path is the active repository/worktree; optional context can specify paths or hunks, message, remote, destination branch, parent branch, and known agent ownership.

### `/git-deliver [context]`

- **Input:** Current task and optional context above.
- **Action:** Inspect, scope, validate, commit if needed, push the feature branch, and verify remotely. Invocation authorizes those steps for the identified task; do not repeatedly ask permission in the standard case.
- **Output:** The summary under Output below.
- **Failure:** Preserve completed steps; explain the smallest unresolved decision. Integration into a parent needs `/git-deliver-merge`.

### `/git-deliver-merge [parent] [context]`

- **Input:** Same context, plus the intended parent when not established by reliable task context or repository policy.
- **Action:** Complete `/git-deliver`, then integrate the delivered commit into the parent, validate the result, and push the parent, following [merge.md](references/merge.md). Invocation authorizes both pushes and ordinary merge integration, subject to existing repository rules.
- **Output:** The summary under Output below, with feature delivery and parent integration reported separately, each with remote proof.
- **Failure:** A successful feature push remains successful if integration is blocked; report exactly where progress stopped.

### `/git-deliver-audit [context]`

- **Input:** Active repository or explicit path; optional parent and remote.
- **Action:** Inspect local changes, outgoing commits, and registered worktrees without staging, fetching, committing, pushing, merging, or cleaning up. Use read-only remote queries if available; label cached tracking refs as cached.
- **Output:** Recommended commit scope, destination candidates, worktree classifications, and unresolved decisions.
- **Failure:** Report inaccessible paths or unknown ownership as unknown, preserving the rest of the audit.

## Behavior

### 1. Establish scope and ownership

Read applicable repository instructions. Record the canonical worktree path, common Git directory, current branch/HEAD, index, unstaged changes, untracked files, ongoing Git operations, and remote configuration. Use `git status --porcelain=v2 --branch -z`, `git diff`, `git diff --cached`, `git worktree list --porcelain -z`, and `git branch -vv`; parse NUL output without splitting filenames on whitespace. Sanitize credential-bearing remote URLs in reports.

Inspect every registered worktree's status when accessible, without modifying it. Read [exceptions.md](references/exceptions.md) when ownership is unknown, worktrees appear abandoned, changes are mixed, or any standard precondition fails.

**Ownership**

- One writer owns each affected worktree and branch during mutation, established from current session/coordinator evidence or an explicit handoff.
- Separate worktrees have separate indexes but share branch refs and configuration. `git worktree lock` protects against removal/pruning; it is not a concurrency mutex.
- With no handoff, stop mutations on any checkout or target branch another agent may be writing.
- Recheck HEAD, index, scoped content, and target refs immediately before each mutation; unexpected drift requires a fresh review. Snapshot checks alone cannot guarantee exclusion of another writer.

**Complete when:** task-owned changes and writable branches are identified; other work stays attributed or explicitly unknown.

### 2. Resolve destinations

Resolve the push remote and destination from the user's request, repository policy, and branch push/upstream configuration, including push URLs. With a single unambiguous remote and no mapping, use the current branch name. Inspect custom push mappings; never use an unqualified `git push` whose scope depends on defaults.

For merge mode, resolve the parent from explicit input, recorded branch-creation context, or applicable repository policy. A tracking upstream such as `origin/feature` is a synchronization destination, not evidence of the parent. Git stores commit parents, not an authoritative branch-parent relationship. Default remote HEAD, reflog, and merge-base history can suggest candidates but cannot settle an ambiguous parent. Ask once with concrete candidates and reasons. Support a parent that is itself a feature branch; do not assume `main`.

For delivery, fetch the selected remote branches without pruning, then inspect ahead/behind counts and all commits that will become newly reachable at each destination. A push publishes existing local commits as well as the new commit. For a new remote branch, review its history against the established base and remote refs; missing base evidence makes scope uncertain. Confirm that no unrelated commits are included. Validate ref names with Git and resolve commits before execution; quote paths and pass literal pathspecs instead of interpolating user prose into shell commands.

**Complete when:** exact repository, remote endpoint, branch refs, outgoing history, and authorization are known. Missing parent information blocks only integration when feature delivery is independently unambiguous and authorized.

### 3. Prepare and commit

Show a short scope summary: included paths or hunks and why, excluded work, validation, and destination. Continue without a question when all changes belong to the current task. For ambiguity, prepare the concrete grouping before asking; see the exceptions reference.

Stage explicit reviewed paths (including reviewed deletions), or selected hunks for mixed files. Review the entire staged diff, not just filenames. Existing unrelated staged content blocks a normal commit until an index-preserving plan is agreed. Avoid blanket `git add .`, `git add -A`, and `git commit -a` as scope shortcuts.

Run documented checks appropriate to the staged result and `git diff --cached --check`. If excluded work affects tests, validate the proposed committed tree in an isolated location or explicitly report that tests are contaminated and unresolved. Check for unintended secrets, generated/runtime files, and submodule changes in scope. Use the repository's commit-message convention; otherwise write a concise intent-focused subject. Commit only after staged content and checks are accounted for. Verify the resulting commit's parent and tree against the reviewed index; hooks may have changed files. Re-review any differences before push.

If nothing new is staged, do not create an empty commit: deliver already reviewed outgoing commits, or report that the branch is already synchronized.

**Complete when:** the exact deliverable commit ID and its validated contents are recorded.

### 4. Push the feature and verify

Recheck local and remote state. Push the recorded commit ID to the explicit destination using `git push <remote> <commit-id>:refs/heads/<destination>`. Configure tracking only if needed and consistent with the resolved mapping; do not overwrite an existing custom upstream silently.

Use `git ls-remote --heads <remote> refs/heads/<destination>` against the actual push endpoint to verify the remote tip. Equality proves delivery at that observation. If another writer advanced it, fetch that branch and use `git merge-base --is-ancestor <delivered-id> <remote-tip>` to prove inclusion. A tracking ref alone is not remote proof. A rejected push or unavailable verification is partial success.

**Complete when:** the remote branch is proven to contain the delivered commit. Continue to step 5 only for `/git-deliver-merge`.

### 5. Integrate into the parent and publish

Follow [merge.md](references/merge.md).

**Complete when:** remote parent inclusion is verified, or a precise partial result and blocker are reported.

## Constraints and failure behavior

- Authorization applies to the invoked workflow and identified task, not all worktrees. Merely loading this skill or asking to design it does not authorize publishing repository changes.
- Preserve user files, existing staging, stashes, refs, and other agents' work. No automatic reset, stash, clean, deletion, force-push, amend, rebase, hook bypass, or global Git configuration changes.
- Stop on the first failed mutation, retain its output, and inspect state before proceeding. On retry, start from observed commits and remote refs so completed commits/pushes are not duplicated.
- For conflicts, authorization failures, unavailable validation, divergent histories, detached HEAD, or uncertain scope, follow [exceptions.md](references/exceptions.md). Never report unavailable checks as passed.

## Output

Return a compact summary in the user's language:

- **Scope:** included work and intentionally remaining changes.
- **Commit:** ID and subject, or no new commit needed.
- **Feature remote:** endpoint/branch and verified tip or blocker.
- **Parent:** not requested, integrated and published, or precise pending stage.
- **Validation:** checks passed/failed/not run and their scope.
- **Worktrees:** relevant ownership or orphan candidates; nothing deleted.

## Credits

Based on official Git documentation: [worktree](https://git-scm.com/docs/git-worktree), [branch and upstream tracking](https://git-scm.com/docs/git-branch), [push and explicit refspecs](https://git-scm.com/docs/git-push), [merge and fast-forward behavior](https://git-scm.com/docs/git-merge), and [ancestry checks](https://git-scm.com/docs/git-merge-base). The scope and ownership gates are this skill's workflow policy. No runtime dependency on these sites.
