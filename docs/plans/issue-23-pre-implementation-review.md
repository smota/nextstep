# Pre-implementation review — issue 23

Status: **proposed**

Date: 2026-10-21

Reviewer: Grok, in the implementation-planner node. This is the explicit Grok pre-implementation technical review of the proposed acceptance doc and ADR against issue #23.

This file is not an independent Codex review. It does not claim a Codex identity. It is not reviewer sign-off, not PR readiness, and not closure. It does not record design acceptance. The acceptance doc, ADR 014, and the implementation plan stay proposed.

Subjects:

- [docs/plans/issue-23-planned-career-actions.md](issue-23-planned-career-actions.md)
- [docs/adr/014-planned-career-actions-v5.md](../adr/014-planned-career-actions-v5.md)
- [docs/plans/issue-23-implementation.md](issue-23-implementation.md)

Issue text used: the issue #23 body supplied to this node. No GitHub fetch.

Code read in this worktree to check that the plan names real files: `src/model.mjs` (`RECORD_TYPES`, `loadModel`, `validateModel`, `json`, `sha`), `src/storage.mjs` (`outputs`, `applyTransaction`, `recoverTransactions`, `dryRunMutation`, `mutate`), `src/commands.mjs` (`ENTITY_TYPES`, `applyStrategyAttribution`, `bootstrapSnapshots`, `recordSubmission`), `src/cli.mjs` (`ROUTES`, `routeNames`, `help`), `src/command-catalog.mjs` (`COMMAND_CONTRACTS`, `commandNames`), `test/fixtures/career-vault.mjs`, `docs/cli.md`, `docs/data-layout.md`, and the accepted graph `.meshloop/plans/issue-23.json` nodes 4 through 9. This attempt did not re-read `test/cli.test.mjs`, `test/opportunity-structured-fields.test.mjs`, `scripts/c0-baseline.mjs`, or `docs/architecture.md`. The plan still names those files from the issue, the acceptance doc, and the graph. Product code was not changed. `npm test` was not run. The graph file was not edited.

## Result

The proposed acceptance doc, ADR, and implementation plan stay proposed. They match issue #23 on the checks below, and they match the accepted graph's nodes 4 through 9 on ownership and allowed paths. A later independent Codex review of the plan returned six conflicts. This revision applies those findings in the proposed docs. It does not claim that review passed, and it does not record design acceptance. No product code was implemented. `npm test` was not run.

## Checks

| Check | Result | Where it is fixed |
| --- | --- | --- |
| Upgrade recovery runs before ledger trust | Pass | Acceptance doc, Upgrade apply, steps 1–4. ADR, Upgrade apply, steps 2–5. A prepared journal's ledger publication is restored from the preimage and is not success. |
| Replay runs before source-token comparison | Pass | Acceptance doc step 4 then step 5. ADR replay section: preflight, recover, reload ledger, replay or conflict, then fingerprint comparison only when the digest is not a stored match. |
| Historical `schemaChanged` and `recovery` survive replay | Pass | Both docs. Replay returns the stored objects and does not rewrite the ledger row. |
| Current-invocation recovery is separate | Pass | Finalized name `currentRecovery`, shape `{ performed, journals }`, replay success only. Fresh apply and recover-only keep top-level `recovery`. Rejection keeps `error.details.recovery`. |
| Reproduction: other prepared journal, then replay of a stored row whose `recovery.performed` is false | Pass | Acceptance criterion 7 and ADR criterion 7. The following recover-only finds no journal. |
| Completion evidence is distinct from direction and time | Pass | External completion is an event match on confirmed kind and subject foreign keys. A confirmed `conversation` or `interview` completes without direction and without a usable `occurred_at`. Clocks still require a real `occurred_at`. Undirected `conversation` and `interview` stay unknown. Internal completion does not use an interaction and does not move clocks. |
| `action list` and `action get` are discoverable | Pass | Frozen commands in both docs. The plan puts both on `src/cli.mjs` routes and help, `COMMAND_CONTRACTS`, `docs/cli.md`, and the read-only test list in `test/actions.test.mjs`. |
| No public init command | Pass | Acceptance decisions, ADR, and the plan. Node 6 asserts `routeNames()` has no init route. Upgrade does not create a vault. |
| No skill edits | Pass | Non-goals in the acceptance doc, the ADR, and every later node in the plan. Shared skill files wait for Issue 3. |
| Issues #24 and #25 excluded | Pass | Non-goals in all three proposed docs. The later nodes must not edit that scope. |
| `experimentId` requires a cohort that belongs to it, and `cohortId` requires `experimentId` | Pass | Corrected in the acceptance doc. Already in the ADR from `applyStrategyAttribution` in `src/commands.mjs`. Status gates stay off. |
| Synthetic fixtures and failure injection | Pass | Acceptance criterion 14 and ADR criterion 14. The plan names `test/fixtures/vault-v4.mjs` and the `onPhase` seam. |
| Torn multi-file reads | Pass | Acceptance criterion 13 and ADR criterion 13. The docs node writes the same limitation into `docs/cli.md`, `docs/data-layout.md`, and `docs/architecture.md`. Current `docs/cli.md` already says this for `pipeline status` and `readiness`. It does not yet say it for preview, list, or get. That doc edit is a later node, not this one. |
| v4 fixture separated from v5 default factories | Pass | Plan node 5: default writers become v5, including `scripts/c0-baseline.mjs`. `test/fixtures/vault-v4.mjs` is the only ready v4 writer and is created by node 5. Node 6 imports it and does not edit it. |
| Module ownership matches graph nodes 4–9 | Pass | Node 5 owns collection registration, the ordinary version guard, factories, and `scripts/c0-baseline.mjs`, and does not create upgrade or action modules. Node 6 creates only `src/model-upgrade.mjs` and does not edit `scripts/c0-baseline.mjs`. Node 7 creates only `src/actions.mjs` and may edit `src/model.mjs` to call `validateActions`. Node 8 owns operator docs, `docs/stack-conventions.md`, and `test/planned-actions-discovery.test.mjs`. Node 9 records `npm test` and edits no product file. Shared files stay serialized. |
| Ordinary v4 guard is before recovery and replay | Pass | Acceptance doc "Read versus mutation", ADR "Version gate", and plan node 5. Consistent v4, including dry-run, a matching ledger digest, and a prepared journal, returns `VAULT_UPGRADE_REQUIRED` and preserves bytes. Upgrade keeps preflight, recover, reload ledger, replay or conflict, then source-token comparison. |
| `validateModel` calls `validateActions` | Pass | Plan node 7 and ADR modules. Lifecycle stays in `src/actions.mjs`. Node 5 only accepts `action:` ids and an empty array. |
| Company with no vacancy, and a person-only plan | Pass | Acceptance criterion 10 and plan node 7. The subject company is synthetic and has no opportunity and no application attempt. `company:acme` is not that company. A person-only plan succeeds and leaves `company_id` and company membership unchanged. |
| Discovery compares shipped schemas | Pass | `test/planned-actions-discovery.test.mjs` compares discovery and `docs/cli.md` examples with `COMMAND_CONTRACTS`. Node 8 also changes the one architect checklist sentence in `docs/stack-conventions.md`. The plan does not create `test/issue-23-docs.test.mjs`. |
| Commitment boundary | Specified in these proposed docs | Plan node 6 and criteria 14. Rollback runs only while the journal is still `prepared`. A handled `journal-delete` exception after the committed marker returns `JOURNAL_CLEANUP_FAILED`, preserves published bytes and the ledger row, and leaves the journal `committed`. Restart drops that journal and replays. This row is not an independent review pass. |
| Every implementation stage leaves `npm test` green | Pass as a plan rule | Nodes 5, 6, 7, and 8 each run `npm test` (`node --test test/*.test.mjs`) and record the result before finishing. Node 9 runs it again and records only that note. This review did not run `npm test`. |

## Corrections made in this review

The acceptance doc and ADR were already proposed and already carried the upgrade order, the action commands, list and get, the contact-clock rules, no init, no skill edits, and the #24 and #25 exclusion. They were short in the places below. Those places now agree with the issue and with each other. Status stays proposed.

1. `currentRecovery` was still a working name in the ADR, and the acceptance doc did not carry the replay field or the reproduction. Both docs now use one schema. `performed` is true exactly when `journals` is greater than zero. The field is top-level on a replayed `model upgrade-apply` success only. It is not stored in the ledger result.

2. The acceptance doc required a cohort to belong to the experiment and required `cohortId` to have an `experimentId`. It did not say that `experimentId` requires that cohort. Issue #23 requires the product's current association rules. `applyStrategyAttribution` requires a valid `cohortId` whenever `experimentId` is present, and it rejects `cohortId` without `experimentId`. The acceptance doc now says both directions. Execution-status gates stay excluded.

3. The issue's synthetic fixture, hash, and failure-injection test plan was not an acceptance criterion. It is now criterion 14 in both docs.

4. The issue requires torn multi-file read documentation in the three operator docs, including upgrade preview and action reads. That is now criterion 13 in both docs. The docs themselves are not edited in this node.

5. After those alignments, one ADR sentence still said the acceptance doc omitted the reverse `experimentId` rule and that the ADR does not edit the acceptance doc. That sentence now matches the aligned acceptance doc and points at "Scope alignment applied to the acceptance doc".

6. A later independent Codex review failed the plan on six points. This revision applies them and leaves every design doc proposed. It does not claim that review passed. Graph nodes 4 through 9 are mapped with the graph's allowed paths. Node 5 is foundation. Node 6 is upgrade. Ordinary `mutate` and `dryRunMutation` classify a consistent v4 vault before `recoverTransactions` and before ledger replay. Node 7's `validateModel` calls `validateActions`. The no-vacancy case is a synthetic company, with a separate person-only success. Node 8 uses `test/planned-actions-discovery.test.mjs` and the one `docs/stack-conventions.md` sentence. The duplicate plan tail that still described the rejected ordering was removed.

7. A following independent review left finding 6 open: today's `applyTransaction` catch restores preimages when journal deletion throws after the committed marker. The proposed docs now limit that restore to a journal that is still `prepared`. Node 6 splits the helper in `src/storage.mjs`. Upgrade uses that helper and does not add a second writer. A handled `journal-delete` injection after the marker returns `JOURNAL_CLEANUP_FAILED`, keeps the published bytes and ledger row, and leaves the journal `committed`. Restart drops that journal without restoring and replays the stored success. If deletion actually finishes, the call returns the normal apply success and leaves no journal. This item does not claim that independent review passed.

The implementation plan names the files and tests that carry those corrections. It does not mark them implemented.

## Code facts the plan relies on

These are observations from the files this attempt opened, not changes.

- `loadModel` ignores `schema_version` and returns eight arrays. `outputs()` stamps `schema_version` 4 and eight counts through `counts(model)`. `renderIndexes` has no actions page. `validateModel` checks id prefixes and does not yet know action structure. Node 5 moves the stamp to version 5, adds the ordinary version guard, and rethrows `VAULT_UPGRADE_REQUIRED` from doctor. Node 7 adds the `validateActions` call. This attempt did not re-read the `doctor` function body. The acceptance doc already records that doctor can return `degraded`.
- `mutate` calls `recoverTransactions` and can return a matching ledger result before `loadModel`. `dryRunMutation` returns a matching ledger result before `loadModel`. `applyTransaction` writes files, writes `committed`, and deletes the journal in one try. Any throw from that try restores preimages, including a throw from deletion after the marker. `recoverTransactions` restores each prepared journal as it walks and throws `UNSAFE_JOURNAL` when a later preimage path is unsafe. The plan does not leave the ordinary replay order, or that unconditional restore, in place. Node 5 classifies the live vault before recovery and before replay. Node 6 adds inspect-then-restore for upgrade, splits `applyTransaction` so restore runs only while the journal is `prepared`, and does not call `recoverTransactions` for the upgrade path. Abrupt `onPhase` crashes do not enter either catch. `onPhase('journal-delete')` throws only into the post-marker cleanup step.
- `RECORD_FILES` is eight names. The ready v4 writer opened here is `test/fixtures/career-vault.mjs`, which writes `schema_version: 4`, `company:acme`, and `opportunity:acme-lead`. The acceptance doc also names `test/cli.test.mjs`, `test/opportunity-structured-fields.test.mjs`, and `scripts/c0-baseline.mjs`. This attempt did not re-open those three. Node 5 re-scans before it edits, writes those ready vaults as v5, and leaves `test/fixtures/vault-v4.mjs` as the only ready v4 writer. The no-vacancy test does not use `company:acme`.
- `ENTITY_TYPES` has no action type. `routeNames()` is `[...ROUTES.keys()]` in `src/cli.mjs`. `commandNames()` is `Object.keys(COMMAND_CONTRACTS)`. The plan keeps `ENTITY_TYPES` without `action` and keeps those two lists in parity.
- `docs/cli.md` says `pipeline status`, like `readiness`, can observe a torn read across sequential per-file writes. It does not yet say that for preview, list, or get. `docs/data-layout.md` says the canonical model uses eight collections. The docs node updates those files. This review does not.

## What this review does not do

- It does not accept the design.
- It does not pass the implementation-planner role. Origin collects and verifies that pass.
- It does not pass the reviewer role or PR readiness.
- It does not dispatch node 4 or any later node.
- It does not implement product code, edit skills, publish, or spawn workers.
- It does not run `npm test`.
- It does not claim the independent Codex review passed.

The six findings named in the origin packet are applied in these proposed docs. The remaining post-marker handled-cleanup gap is specified here as design text only. This correction does not record design acceptance and does not claim that the independent review passed. Graph node 4 is still the only node that may change status from proposed to accepted, and only when its dispatch contains the origin's recorded design-acceptance authority. Do not dispatch nodes 5 through 9 until that acceptance is recorded. Do not implement product code from this plan until that gate is recorded.
