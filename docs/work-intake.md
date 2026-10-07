# Work intake and execution

How every agent (Claude, Codex, Pi, Grok, Agy, Copilot) and every human manages backlog and runs work in this repository. AgentFlow governs the work; Meshloop executes it when more than one agent is needed. Phase and role-pass detail lives in [agent workflow](agent-workflow.md); issue format and labels live in [issue standards](issue-standards.md).

## Backlog: GitHub Issues only

The backlog is the open issues of `smota/nextstep`. Nothing else in the repository is a backlog: cycle specs, plans, and ADRs are design records, and Meshloop or AgentFlow state is disposable run state.

- **Read it:** `gh issue list --state open`.
- **Add to it:** open an issue from `.github/ISSUE_TEMPLATE/` with one type label (`feature`, `bug`, `dx`, `tooling`, `documentation`, `qa`) and `drafted-by:<runtime>` when an agent drafts it. Fill **Acceptance criteria** and **Workflow classification** (profile from `sdlc.config.json`). Show the draft to the user and wait for confirmation before `gh issue create`.
- **Deferred work found mid-task:** a follow-up issue linked from the PR. Record follow-ups as issues so the backlog stays in one place.
- **Requests from an external inbox** (`mtn-dev-inbox`) take the same issue flow; the receipt's `native_ref` is the issue URL.
- **Private instance work** (career data, personal paths, data-folder operations) stays in the private instance's own tracker. The repository is public: an issue carries only product scope.
- **Labels** are declared in `.github/labels.json`; sync them with `gh label create <name> --color <hex> --description <text> --force` after editing the manifest.

## Execution: one issue, one branch, one PR

1. **Select.** Pick an open issue, add `for-implementation:<runtime>`, and post the issue's single workflow-status comment (updated in place from here on).
2. **Classify.** The profile on the issue fixes the required roles (`sdlc.config.json` → `paths`). Use `agentflow-collaborator` to choose the mode; the default is `single-agent` (`agent-workflow.config.json` → `routing`). Choose **mesh** when the plan splits into independent nodes, or when the profile requires an independent reviewer (`allowsSelfReview: false`).
3. **Run** in the chosen mode (below), on a work branch named with a prefix from `agent-workflow.config.json` → `branching.workBranchPrefixes` and the issue number, e.g. `feature/18-career-intents`.
4. **Deliver.** One PR into `main` whose body says `Implements #<n>`, with the workflow-evidence section of `.github/pull_request_template.md`. Labels move `implemented-by:` → `for-review:` → `reviewed-by:`; after merge the integration lifecycle adds `integrated:main` and `awaiting-release` and closes the issue.

The step is done when the issue is closed by its merged PR and the workflow-status comment records the PR, merge commit, and (in mesh mode) the Meshloop graph id.

### Single-agent mode

Invoke `agentflow-orchestrator` with the issue. It walks the role passes in one session and keeps local notes under `.agent-runs/issues/<n>/`.

### Mesh mode

The session that holds the issue is both `agentflow-orchestrator` and `meshloop:origin`: it supervises, integrates, and opens the PR, and leaves implementation to Meshloop workers.

| AgentFlow role | Meshloop owner |
|---|---|
| analyst (acceptance criteria) | origin, on the issue, before planning |
| implementation-planner | `meshloop:planner` via `/meshloop:plan` |
| developer, tester | `meshloop:worker` nodes, one Git worktree each |
| reviewer | `meshloop:reviewer` leaves via `/meshloop:orchestrate`, on a runtime other than the node's worker |
| pr-readiness | origin, after `/meshloop:accept` |

1. `gh issue view <n> --json title,body > .meshloop/intent/issue-<n>.md`, then `/meshloop:plan` with `--intent-file` pointing at it and `--out .meshloop/plans/issue-<n>.json`.
2. `/meshloop:review-plan`: the user answers Accept, Decline, or Adjust. Record the answer and graph id in the workflow-status comment.
3. `/meshloop:run`, then `/meshloop:orchestrate` per implementation node for cross-runtime review, then `/meshloop:accept` after the user agrees. `/meshloop:status` reports progress.
4. From the issue's work branch, `meshloop integrate --graph <id> --json` brings in the accepted nodes (`run` never merges into your branch). Run the CI commands from `agent-workflow.config.json` → `ciCommands`, and deliver as above.

## Local run state

`.meshloop/`, `.agent-runs/`, and `.agentflow/transactions/` hold run state for the active session only. They are gitignored; their durable record is the issue comment and the PR.
