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

Code read in this native attempt to check that the plan names real files: `src/model.mjs` (`RECORD_TYPES`, `loadModel`, `json`, `sha`), `src/storage.mjs` (`outputs`, `recoverTransactions`, `renderIndexes`), `src/commands.mjs` (`ENTITY_TYPES`, `applyStrategyAttribution`, `bootstrapSnapshots`, `recordSubmission`), `src/cli.mjs` (`ROUTES`, `routeNames`, `help`), `src/command-catalog.mjs` (`COMMAND_CONTRACTS`, `commandNames`), `test/fixtures/career-vault.mjs`, `docs/cli.md`, `docs/data-layout.md`. This attempt did not re-read `test/cli.test.mjs`, `test/opportunity-structured-fields.test.mjs`, `scripts/c0-baseline.mjs`, or `docs/architecture.md`. The plan still names those files from the issue and the acceptance doc's observed writers. Product code was not changed. `npm test` was not run.

## Result

The proposed acceptance doc and ADR now match issue #23 on the checks below. Where they were short of the issue, or short of the corrected replay contract the issue's recovery rules require, this node corrected those proposed docs and left them proposed. No product code was implemented.

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
| No public init command | Pass | Acceptance decisions, ADR, and the plan. The upgrade node test asserts `routeNames()` has no init route. Upgrade does not create a vault. |
| No skill edits | Pass | Non-goals in the acceptance doc, the ADR, and every later node in the plan. Shared skill files wait for Issue 3. |
| Issues #24 and #25 excluded | Pass | Non-goals in all three proposed docs. The later nodes must not edit that scope. |
| `experimentId` requires a cohort that belongs to it, and `cohortId` requires `experimentId` | Pass | Corrected in the acceptance doc. Already in the ADR from `applyStrategyAttribution` in `src/commands.mjs`. Status gates stay off. |
| Synthetic fixtures and failure injection | Pass | Acceptance criterion 14 and ADR criterion 14. The plan names `test/fixtures/vault-v4.mjs` and the `onPhase` seam. |
| Torn multi-file reads | Pass | Acceptance criterion 13 and ADR criterion 13. The docs node writes the same limitation into `docs/cli.md`, `docs/data-layout.md`, and `docs/architecture.md`. Current `docs/cli.md` already says this for `pipeline status` and `readiness`. It does not yet say it for preview, list, or get. That doc edit is a later node, not this one. |
| v4 fixture separated from v5 default factories | Pass | Plan: default writers become v5; `test/fixtures/vault-v4.mjs` is the only ready v4 writer and is created by the upgrade node. |
| Module ownership | Pass | `src/model-upgrade.mjs` is created only by the upgrade node. `src/actions.mjs` is created only by the action node. Shared files are serialized. |
| Every later implementation node leaves `npm test` green | Pass as a plan rule | Stated for the upgrade node, the action node, and the docs node. This review did not run `npm test`. |

## Corrections made in this review

The acceptance doc and ADR were already proposed and already carried the upgrade order, the action commands, list and get, the contact-clock rules, no init, no skill edits, and the #24 and #25 exclusion. They were short in the places below. Those places now agree with the issue and with each other. Status stays proposed.

1. `currentRecovery` was still a working name in the ADR, and the acceptance doc did not carry the replay field or the reproduction. Both docs now use one schema. `performed` is true exactly when `journals` is greater than zero. The field is top-level on a replayed `model upgrade-apply` success only. It is not stored in the ledger result.

2. The acceptance doc required a cohort to belong to the experiment and required `cohortId` to have an `experimentId`. It did not say that `experimentId` requires that cohort. Issue #23 requires the product's current association rules. `applyStrategyAttribution` requires a valid `cohortId` whenever `experimentId` is present, and it rejects `cohortId` without `experimentId`. The acceptance doc now says both directions. Execution-status gates stay excluded.

3. The issue's synthetic fixture, hash, and failure-injection test plan was not an acceptance criterion. It is now criterion 14 in both docs.

4. The issue requires torn multi-file read documentation in the three operator docs, including upgrade preview and action reads. That is now criterion 13 in both docs. The docs themselves are not edited in this node.

5. After those alignments, one ADR sentence still said the acceptance doc omitted the reverse `experimentId` rule and that the ADR does not edit the acceptance doc. That sentence now matches the aligned acceptance doc and points at "Scope alignment applied to the acceptance doc".

The implementation plan names the files and tests that carry those corrections. It does not mark them implemented.

## Code facts the plan relies on

These are observations from the files this attempt opened, not changes.

- `loadModel` ignores `schema_version` and returns eight arrays. `outputs()` stamps `schema_version` 4 and eight counts through `counts(model)`. `renderIndexes` has no actions page. The upgrade node rethrows `VAULT_UPGRADE_REQUIRED` and moves the stamp to version 5 in the same node as the v5 factories, so ordinary tests do not land on a half-upgraded vault. This attempt did not re-read the `doctor` function body. The acceptance doc already records that doctor can return `degraded`.
- `recoverTransactions` restores each prepared journal as it walks the directory and throws `UNSAFE_JOURNAL` when a later preimage path is unsafe. The issue forbids that partial restore on upgrade. The plan adds inspect-then-restore for upgrade and leaves ordinary `mutate` on the current function.
- `RECORD_FILES` is eight names. The ready v4 writer opened here is `test/fixtures/career-vault.mjs`, which writes `schema_version: 4` and counts from the eight model keys. The acceptance doc also names `test/cli.test.mjs`, `test/opportunity-structured-fields.test.mjs`, and `scripts/c0-baseline.mjs`. This attempt did not re-open those three. The upgrade node re-scans before it edits, then leaves the dedicated v4 fixture as the upgrade-test writer.
- `ENTITY_TYPES` has no action type. `routeNames()` is `[...ROUTES.keys()]` in `src/cli.mjs`. `commandNames()` is `Object.keys(COMMAND_CONTRACTS)`. The plan keeps `ENTITY_TYPES` without `action` and keeps those two lists in parity.
- `docs/cli.md` says `pipeline status`, like `readiness`, can observe a torn read across sequential per-file writes. It does not yet say that for preview, list, or get. `docs/data-layout.md` says the canonical model uses eight collections. The docs node updates those files. This review does not.

## What this review does not do

- It does not accept the design.
- It does not pass the implementation-planner role. Origin collects and verifies that pass.
- It does not pass the reviewer role or PR readiness.
- It does not dispatch node 4 or any later node.
- It does not implement product code, edit skills, publish, or spawn workers.
- It does not run `npm test`.

ORIGIN STOP: after this node, do not dispatch node 4 or any later node, even if graph edges are ready. First collect an independent Codex review of this proposed contract, ADR, and plan from outside the Grok workers. Human graph acceptance does not pre-accept this unseen design. Resolve any findings by dispatching a correction with the Codex packet. Record design acceptance only after that review and any Grok correction.
