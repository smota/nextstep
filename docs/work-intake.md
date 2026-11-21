# Work intake and execution

How every agent (Claude, Codex, Pi, Grok, Agy, Copilot) and every human manages backlog and runs work in this repository. **AgentFlow** (`standard` profile) is the default delivery workflow. **Meshloop** is an opt-in tool for multi-node work.

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
2. **Branch.** Create a work branch off `main` named `work/<slug>` (`feature/`, `fix/`, `chore/`, `hotfix/` and `spike/` are also valid) with the issue number, e.g. `work/23-planned-career-actions`.
3. **Run the role passes.** Follow the AgentFlow `standard` profile in [`agent-workflow.config.json`](../agent-workflow.config.json): requirements, design, plan, build, test, review, docs, PR readiness. One agent runs them by default. Record each pass in the issue's workflow-status comment and fill the PR's Agent Review section with the runtime that did the work, as AgentFlow requires. Never add a co-author trailer, a "Generated with" line or a session link.
4. **Verify.** Run `npm test` and `npm run check` (the `ciCommands`), plus `npm run skills:package` when skills changed.
5. **Deliver.** Open one PR into `main` whose body says `Implements #<n>`, using the PR template.
6. **Close.** Samuel merges (squash). After merge, close the issue and update the workflow-status comment.

## Opt-in: Meshloop

Use Meshloop only when the user names it, or the issue splits into three or more independent nodes. `meshloop.toml` stays in the repo for that case. Meshloop owns technical execution (plan, worktrees, workers, technical acceptance); AgentFlow still owns the role passes, the PR and the merge gate.

- **`meshloop:origin`** supervises in the work branch: prepares intent, runs `/meshloop:doctor`, triggers planning, integrates results. It never implements.
- **`meshloop:planner`** decomposes intent into a bounded task graph: `meshloop plan --intent-file .meshloop/intent/issue-<n>.md --out .meshloop/plans/issue-<n>.json`. Run `/meshloop:review-plan`; the user or origin accepts, declines or adjusts.
- **`meshloop:worker`** implements tasks in isolated worktrees under `.meshloop/worktrees/`. Each attempt passes `npm test` via `meshloop.toml`.
- **`meshloop:reviewer`** reviews worker diffs on a harness different from the worker's (`/meshloop:orchestrate`), then `/meshloop:accept` records node acceptance.
- **Integrate.** `meshloop integrate --graph <id> --json` merges accepted nodes into the work branch. Continue at step 4 above.

## Local run state

`.meshloop/` (including `.meshloop/worktrees/`) and `.agent-runs/` hold run state for the active session only. They are gitignored; their durable record is the issue comment and the PR.
