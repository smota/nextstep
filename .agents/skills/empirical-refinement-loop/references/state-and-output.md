# Repository continuity and outputs

## Connect before creating

Use `.empirical-refinement-loop/state.json` as the stable entry point. Resolve stored paths relative to the project root. Read the referenced approach and relevant scorecard sections first; open historical rounds only for a decision, failure, or drift that requires them.

Without an index, inspect AGENTS.md, README and documentation indexes, then follow relevant engineering, testing, benchmark, ADR and backlog links. Bound discovery to the objective. Present discovered candidates and ask only unresolved questions:

> I found testing and benchmark guidance at these paths. Is there an existing refinement strategy we should follow?

If none is identified, propose a minimal approach and ask whether it belongs in the existing engineering documentation, a dedicated section, or internal skill records. Suggest a concrete location matching the project. Persist the choice and reuse it without asking every conversation. A plan invocation presents the proposal without writing it.

Use [the state template](../assets/state.template.json) after destinations are settled. Each pointer may identify a file and section anchor. Reuse partial documentation rather than creating a competing strategy. Never infer absence merely from an unsuccessful search.

## Minimal project approach

Record only missing decisions, using links for those already documented:

- Scope and entry criteria: observed problem, hypothesis, reproducible baseline.
- Canonical test and measurement sources, environment requirements, and relevant invariants.
- Reviewer preference, independent-review requirement, and objection resolution.
- Acceptance, inconclusive results, regression tolerance, and stopping budgets.
- Evidence destinations, retention, checkpoint rules, and method revision policy.

If a project map is useful, keep it as a compact section or document at the chosen location: components, entry points, test coverage, commands and their source files, known gaps, and last inspection revision. Label statements as observed, declared, or unverified. Store pointers and concise summaries rather than copies of source material.

## Freshness and safe resume

The index stores schema version, document pointers, current cycle/round/step, last inspected code identity, criteria version, evidence pointers, and last accepted result. It is navigation state, not a second scorecard or transcript.

For schema version 1, document values are project-relative path strings (optionally with section anchors) or null when unresolved. Populate `active` with `cycle_id`, `round_id`, `step`, `status`, and `record_path`; status is `running`, `blocked`, `inconclusive`, `failed`, or `completed`. Populate `last_inspected` with `at` (UTC), `revision` (nullable), `content_hashes` (path-to-SHA-256 map for relevant files), and `environment_record` (evidence path). `criteria_version` identifies the native scorecard revision. `evidence_paths` is an array of project-relative paths. Populate `last_accepted` with cycle/round IDs, candidate identity, criteria version and result record path only after acceptance. Null means unknown or not yet established, never successful. Preserve unrelated supported fields during updates.

Before resume, inspect changes since the recorded revision and relevant manifests, commands, environment and measurement definitions. For dirty or non-Git projects, use content hashes of the relevant files and record their scope. A commit hash alone does not identify uncommitted candidate bytes. Revalidate only affected knowledge; explain when comparability requires a new baseline.

Keep accepted evidence distinct from interrupted or rejected attempts. Reconcile artifacts written before an interruption before retrying the step. Write state through a temporary file and atomic replacement where supported, after evidence has been recorded. Check that state has not changed since reading; on a concurrent writer, stop and reconcile rather than overwrite. Use one agreed writer per project index. Unsupported schema versions require an explicit migration proposal, preserving the original.

## Cycle records

Use existing engineering record conventions; otherwise propose a cycle directory at the agreed location with a brief, one record per round, and a closeout. The [round template](../assets/round-proposal.template.md) is a starting shape, not a required duplicate of existing records.

Each round preserves the hypothesis, baseline/candidate identities, criteria version, reviewer identity and exchanges, decisions, commands, evidence paths, result, and next action. Record raw evidence separately with enough environment and sample information to reproduce the result. Redact secrets before durable storage or provider transmission. Agree retention for bulky artifacts; retain compact summaries and mark unavailable historical evidence as unavailable.

Version durable strategy, criteria, index, and summaries according to the project's documentation policy. Do not ignore the entire hidden directory automatically. Ignore raw generated artifacts only where appropriate; internal-only placement does not imply that records are unversioned.

## Backlog and consolidation

Correct scoped blockers within budget. For broader findings, use the existing backlog and stable IDs, with [the backlog template](../assets/backlog-item.template.md) only where needed. Update matching items rather than duplicating them. An out-of-scope violation of a required invariant remains a blocker even after a backlog item exists.

At closeout, move durable knowledge into the existing approach or map, actionable work into backlog, and retain discussion in cycle records. Update README only for reader-relevant durable changes. Report accepted, failed, blocked and inconclusive rounds distinctly, with validation not run explicitly identified.

Briefly evaluate the activity itself: did review expose a useful risk, did the test detect the real failure, was the comparison reproducible, and did missing context cause rework? Amend the approach only when this reveals a concrete shortcoming. Record the reason and criteria-version impact; a method change cannot retroactively approve a failed round.
