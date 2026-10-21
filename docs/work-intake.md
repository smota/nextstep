# Work intake and execution

How every agent (Claude, Codex, Pi, Grok, Agy, Copilot) and every human manages backlog and runs work in this repository. **Meshloop** is the sole multi-agent planning, execution, review, and integration workflow for Nextstep.

## Backlog: GitHub Issues only

The backlog is the open issues of `smota/nextstep`. Nothing else in the repository is a backlog: cycle specs, plans, and ADRs are design records, and Meshloop run state is disposable local state.

- **Read it:** `gh issue list --state open`.
- **Add to it:** open an issue from `.github/ISSUE_TEMPLATE/` with one type label (`feature`, `bug`, `dx`, `tooling`, `documentation`, `qa`) and `drafted-by:<runtime>` when an agent drafts it. Fill **Acceptance criteria**. Show the draft to the user and wait for confirmation before `gh issue create`.
- **Deferred work found mid-task:** a follow-up issue linked from the PR. Record follow-ups as issues so the backlog stays in one place.
- **Requests from an external inbox** (`mtn-dev-inbox`) take the same issue flow; the receipt's `native_ref` is the issue URL.
- **Private instance work** (career data, personal paths, data-folder operations) stays in the private instance's own tracker. The repository is public: an issue carries only product scope.
- **Labels** are declared in `.github/labels.json`; sync them with `gh label create <name> --color <hex> --description <text> --force` after editing the manifest.

## Execution: one issue, one branch, one PR

1. **Select.** Pick an open issue, add `for-implementation:<runtime>`, and post the issue's workflow-status comment (updated in place from here on).
2. **Branch.** Create a work branch off `main` named with an appropriate prefix (`feature/`, `fix/`, `chore/`, `spike/`, `hotfix/`, `dx/`) and the issue number, e.g. `feature/23-planned-career-actions`.
3. **Plan & Run with Meshloop.** Meshloop governs task decomposition, worktree isolation, verification, and orthogonal review:
   - **`meshloop:origin`**: The supervisor session in the work branch. Prepares intent, runs `/meshloop:doctor`, triggers planning, and integrates results.
   - **`meshloop:planner`**: Decomposes intent into a bounded, acyclic task graph via `/meshloop:plan` (e.g. `meshloop plan --intent-file .meshloop/intent/issue-<n>.md --out .meshloop/plans/issue-<n>.json`).
   - **Plan review**: Run `/meshloop:review-plan`. The user or origin reviews the graph and accepts, declines, or adjusts.
   - **`meshloop:worker`**: Dispatches tasks in isolated Git worktrees (`.meshloop-worktrees/`). Each attempt must pass deterministic verification (`npm test` via `meshloop.toml`).
   - **`meshloop:reviewer`**: Dispatches orthogonal review leaves via `/meshloop:orchestrate` on a harness distinct from the worker's.
   - **Node acceptance**: Review evidence and record acceptance via `/meshloop:accept`.
4. **Integrate.** From the issue's work branch, run `meshloop integrate --graph <id> --json` to merge the accepted nodes into the branch.
5. **Verify & Deliver.** Run repository verification (`npm test`, `npm run check`, `npm run skills:package`). Open one PR into `main` whose body says `Implements #<n>`.
6. **Close.** After merge to `main`, close the issue and update the workflow-status comment.

## Meshloop Roles Summary

| Role | Responsibility | Meshloop Mechanism |
|---|---|---|
| `meshloop:origin` | Issue supervisor, work branch owner, PR author | Origin session / supervisor |
| `meshloop:planner` | Decomposes issue intent into bounded task graph | `/meshloop:plan` |
| `meshloop:worker` | Implements scoped task changes in isolated worktree | Direct CLI dispatch in `.meshloop-worktrees/` |
| `meshloop:reviewer` | Orthogonal review of worker node diffs | `/meshloop:orchestrate` |

## Local run state

`.meshloop/`, `.meshloop-worktrees/`, and `.agent-runs/` hold run state for the active session only. They are gitignored; their durable record is the issue comment and the PR.
