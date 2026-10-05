# Exceptional delivery decisions

Read when a standard precondition fails. Explain the concrete choice and its consequence before asking for missing input. Preserve existing authorization; ask about the unresolved scope or strategy only.

| Evidence | Action |
|---|---|
| Mixed changes or uncertain authorship | Group changes into current task, unrelated work, and uncertain hunks. Show proposed commit contents and exclusions. Ask which uncertain group belongs; do not infer ownership from file location alone. |
| Unrelated content already staged | Record staged versus unstaged content. Propose an isolated index or explicit staging adjustment that preserves the original index. Do not silently unstage another agent's work. |
| Detached HEAD | Record HEAD and changes. Propose a named feature branch at that commit and establish ownership before continuing. Detached does not mean abandoned. |
| Remote branch ahead or divergent; push rejected | Fetch and compare histories. Behind-only with no new work can be reported as already included if ancestry proves it. For divergent work, propose merging remote changes into the feature and rerun validation, or follow explicit repository policy. |
| Parent has unrelated local commits | Show the commits that a parent push would include. Obtain scope resolution before integration; do not publish them merely because the feature is authorized. |
| Parent worktree dirty or active | Finish safe feature delivery if possible. Wait for an explicit handoff or propose an isolated integration branch/worktree. Do not switch, clean, stash, or update the occupied parent behind its owner's back. |
| Concurrent drift | Re-inspect and compare the new state with the reviewed scope. Re-establish writer ownership. Stop repeated retries if another writer keeps moving the branch. |
| Merge conflict | List conflicted files and explain the competing behavior. Resolve only where task intent and ownership support a clear choice; otherwise ask. Keep a merge opened by this run pending, or abort only that merge when its starting state was clean and no subsequent user/agent edits would be lost. Never abort a pre-existing operation. |
| Protected parent or PR-required policy | Preserve the published feature branch. Prepare the provider-required integration path and follow existing authorization for PR creation/merge; otherwise request that specific missing step. Do not bypass protection. A PR opened is not a PR merged. |
| Squash/rebase required | Follow the explicitly authorized policy. Do not claim original feature ancestry after rewritten integration. Verify the resulting integration ID on the remote parent, provider merge evidence where applicable, and reviewed content equivalence; report the method. |
| Hooks/signing/tests fail or tools unavailable | Report the failing requirement and preserve the commit/index state. Fix within task scope when possible, then recheck. Do not invent identity, disable checks, or claim delivery complete while required checks remain unresolved. |
| Network/authentication failure | Report local commit versus verified remote state separately. Retry only after inspecting whether the remote already accepted the push. |
| Submodule/LFS work | Inspect repository configuration and required tooling. Submodule commits must be published to their own intended remote before publishing a superproject pointer. Verify required LFS uploads; ask if the authorized scope does not cover these deliveries. |

## Worktree orphan assessment

Inventory only the current repository's registered worktrees unless the user explicitly expands scope. For each, report path, branch or detached HEAD, accessibility, dirty/untracked status, lock/prunable flags, known owner/activity, and commit reachability against freshly verified relevant remote refs (or mark remote evidence stale).

Classify conservatively:

- **Active/owned:** current session or explicit coordinator evidence establishes use.
- **Unknown ownership:** accessible but no reliable lifecycle evidence; clean or old is insufficient.
- **Unavailable:** missing path, permissions issue, offline drive, or moved checkout. Distinguish these where possible.
- **Stale registration candidate:** Git marks it prunable and the path appears absent; recommend investigation/repair before cleanup.
- **Preservation needed:** dirty/untracked content, local-only commits, or a detached tip not proven reachable from the intended durable remote.
- **Cleanup candidate:** ownership is explicitly released, content is clean, and its commits are proven included in the intended remote destination. This is a recommendation, not deletion authority.

`git worktree prune --dry-run --verbose` can expose stale administrative entries without removing them. It does not prove that the user's files are disposable. Git cannot prove agent inactivity, and worktree locks are not task ownership records.

This skill discovers and recommends; cleanup requires a separate explicit request covering exact worktrees/branches. Preserve untracked and ignored content before any authorized removal unless the user explicitly waives backup. Worktree removal, metadata pruning, local branch deletion, and remote branch deletion are separate actions; none is implied by successful delivery.
