# Implementation plan — planned career actions and vault schema v5

Status: **proposed**

Issue: [#23](https://github.com/smota/nextstep/issues/23) — feat: add planned career actions with an explicit v4 to v5 upgrade

Date: 2026-10-21

Profile: `high-assurance`

Surfaces: data, service, docs

Authority: `propose` (implementation planner). This document does not accept itself. It is not an independent Codex review, not reviewer sign-off, not PR readiness, and not closure.

Contract: [issue-23-planned-career-actions.md](issue-23-planned-career-actions.md) and [ADR 014](../adr/014-planned-career-actions-v5.md), both status proposed. Those files are the behavior contract. This plan names the later nodes, files, and tests. It does not implement product code.

Human graph acceptance does not accept this plan, the acceptance doc, or the ADR. Human delivery acceptance remains the integration gate and is pending. Design acceptance is recorded only after an independent Codex review of this proposed contract, ADR, and plan, and after any correction that review requires. Origin must not dispatch the upgrade node, the action node, the docs node, or any later node from this planner node, even if graph edges are ready.

## Gates this plan keeps

- User gate: the approved issue #23 text, including its test plan.
- Node gate: this planner node writes proposed docs only. It does not edit `src/`, `test/`, `scripts/`, `skills/`, or operator docs.
- Design gate: acceptance doc, ADR, and this plan stay proposed until the external Codex review and any follow-up correction.
- Delivery gate: human delivery acceptance stays pending. No publish, commit, push, or worker spawn belongs to this plan's authoring node.

Every later implementation node leaves `npm test` green. `npm test` is `node scripts/test.mjs`. A node that cannot leave the suite green is not finished. This planner node does not run that suite.

## Later nodes and serialization

Three later nodes, in this order. They are not parallel. Origin runs the next node only after the previous node's work is integrated and `npm test` is green.

| Order | Node | Creates | May edit | Must not edit |
| --- | --- | --- | --- | --- |
| 1 | Upgrade node | `src/model-upgrade.mjs`, `test/model-upgrade.test.mjs`, `test/fixtures/vault-v4.mjs` | `src/model.mjs`, `src/storage.mjs`, `src/commands.mjs`, `src/cli.mjs`, `src/command-catalog.mjs`, the ready-vault factories listed below, `test/cli.test.mjs` only for the v5 factory and the nine-file assertion | `src/actions.mjs`, `skills/`, issues #24 and #25 |
| 2 | Action node | `src/actions.mjs`, `test/actions.test.mjs` | `src/commands.mjs`, `src/cli.mjs`, `src/command-catalog.mjs` after the upgrade node has finished | `src/model-upgrade.mjs`, `src/model.mjs`, `src/storage.mjs`, ready-vault factories, `test/fixtures/vault-v4.mjs`, `skills/` |
| 3 | Docs node | `test/issue-23-docs.test.mjs` | `docs/cli.md`, `docs/data-layout.md`, `docs/architecture.md` | `src/`, ready-vault factories, `skills/`, `src/model-upgrade.mjs`, `src/actions.mjs` |

`src/model-upgrade.mjs` is created only by the upgrade node. `src/actions.mjs` is created only by the action node. No other node creates either file, and neither node edits the other module.

Shared files `src/model.mjs`, `src/storage.mjs`, `src/commands.mjs`, `src/cli.mjs`, `src/command-catalog.mjs`, and the ready-vault factories stay serialized. Two nodes must not edit one of those files at the same time. `src/model.mjs` and `src/storage.mjs` and the factories are edited by the upgrade node only. `src/commands.mjs`, `src/cli.mjs`, and `src/command-catalog.mjs` are edited first by the upgrade node and later by the action node, never concurrently.

There is no new public init command. No node adds `init`, `model init`, or a downgrade route.

## Upgrade node

Owns preview, apply, recover-only, the version gate, the v5 manifest stamp, and the split between v5 default factories and the legacy v4 fixture.

### Collection and manifest

In `src/model.mjs`:

- Append `actions` to `RECORD_TYPES` after `experiments`.
- Add `RECORD_FILES.actions = 'actions.json'` and id prefix `action`.
- The missing-records short-circuit includes `actions: []` and still writes nothing.
- `counts()` follows `RECORD_TYPES`, so a loaded v5 model has nine counts.
- `loadModel` reads `manifest.json` before the missing-file check. Integer `4` and `5` are the only recognized versions. Any other version, a missing manifest on an existing records directory, or unreadable manifest JSON is `MODEL_INVALID` with `details.reason` `schema_version` or `unreadable` as the contract specifies.
- A consistent v4 vault is version 4, eight readable career arrays, and eight agreeing counts. `actions.json` is absent, or present only as the canonical empty array from `json([])` (`[]` plus a newline) with no `counts.actions`. Ordinary `loadModel` throws `VAULT_UPGRADE_REQUIRED` with the preview-then-apply message and details `{ schemaVersion: 4, previewCommand: 'model upgrade-preview', applyCommand: 'model upgrade-apply' }`. It does not create `actions.json`.
- Any other v4 `actions.json`, a v4 `counts.actions`, unreadable career JSON, or disagreeing eight-counts is `MODEL_INVALID`.
- v5 with `actions.json` missing is `MODEL_INVALID` reason `actions_missing`, not `MODEL_INCOMPLETE` and not an empty list. Disagreeing `counts.actions` is reason `actions_count`.
- After a recognized version, a missing file among the eight career collections remains `MODEL_INCOMPLETE`.
- Export one classifier the upgrade module calls so ordinary commands and upgrade do not keep two copies of the version rules. Ordinary `loadModel` still throws `VAULT_UPGRADE_REQUIRED` for consistent v4. The upgrade reader uses the classifier and does not throw that code for a consistent v4 or v5 vault.
- `rebuildBacklinks` does not add action ids to parent records. `renderIndexes` does not gain an actions page. `validateModel`'s generic id loop accepts `action:` ids once the collection exists. Action lifecycle rules stay out of `src/model.mjs`.

In `src/storage.mjs`:

- `outputs()` stamps `schema_version` 5 and nine counts from `counts(model)`. It must not stamp version 4. It writes `actions.json` only when that array is already in the loaded model and the bytes differ. It does not invent `actions.json` for a model that never loaded it.
- Export the existing stable envelope digest (today the private `digest` used by `mutate`) so upgrade replay uses one canonicalization.
- Export a lock wrapper that acquires and releases the existing commit lock and does not recover or load the ledger. `mutate` keeps its current body, including its current `recoverTransactions` loop. Upgrade must not call `recoverTransactions`, because that loop restores earlier journals before it sees a later unsafe path.
- Add `inspectDomainJournals(paths)` and `restoreDomainJournals(paths, journals)`. Inspect reads every domain journal, checks state and containment of every preimage, and writes nothing. Unsafe, unknown, or unreadable journals throw `UNSAFE_JOURNAL` with `details.reason` `unsafe`, `unknown`, or `unreadable` and restore nothing. Restore runs only on a set inspect already accepted. `prepared` restores contained preimages. `committed` drops the journal. A ledger row written while the journal is still `prepared` is restored from that preimage.

`src/model-upgrade.mjs` exports preview, apply, and recover-only. It does not validate action records or classify contact clocks.

### Upgrade command behavior

Preview is lock-free and writes nothing. A held lock is not `COMMIT_BUSY` on preview. A pending domain journal, including a readable journal whose preimage is unsafe, is `PENDING_JOURNAL` with `details.recoverCommand` set to `model upgrade-apply --recover-only`, and no token. Preview does not recover and does not use `UNSAFE_JOURNAL`. That code belongs to apply and recover-only, after they inspect the journal set and restore nothing.

The token fields and both write sets are the ones in the acceptance doc. Digests use `sha` / `shaFile` from `src/model.mjs`. An absent audit file uses `sha('')`. An absent ledger uses `{ present: false, sha256: null }`. `projectedIndexSha256` maps only index paths whose `renderIndexes` bytes would change. The write set has no delete list and does not name the eight career files, snapshot bytes, or transmission bytes.

Apply envelope: `schemaVersion` 1, `requestId`, `idempotencyKey`, optional `actor`, `payload.token`. A missing token is `INVALID_COMMAND` before the lock and does not recover. Envelope failures stay `INVALID_ENVELOPE` before the lock.

Under the lock the order is fixed:

1. Inspect every journal before recovery and before reading the ledger.
2. Unsafe, unknown, or unreadable: `UNSAFE_JOURNAL`, no restore, no schema write.
3. Restore only after a clean inspect.
4. Reload the ledger.
5. Same idempotency digest: return the stored success with `replayed: true` and top-level `currentRecovery`. Do not compare the source token on this path. Do not rewrite the ledger result. Do not apply the historical write set again.
6. Different digest for the same key: `IDEMPOTENCY_CONFLICT`, no schema write.
7. Otherwise recompute the fingerprint. Drift is `STALE_REVISION` with `error.details.recovery` for this invocation and no schema write.
8. Matching v4 token: write only the preview write set inside one journal. Audit `command` is `model.upgradeApply`, matching the dotted command strings `mutate` already stores. The route remains `model upgrade-apply`. The appended audit line uses the existing audit object shape. The previous audit prefix stays byte-identical.
9. Matching v5 token: write nothing, including no ledger append and no audit line.

`currentRecovery` schema, finalized:

```json
{ "performed": true, "journals": 1 }
```

`performed` is true exactly when `journals` is greater than zero. `journals` counts journals this invocation restored or dropped. The field is present only on a replayed apply success. A fresh apply stores top-level `recovery` and `schemaChanged` and does not add `currentRecovery`. Recover-only uses top-level `recovery` and `schemaChanged: false` and does not add `currentRecovery`. A rejection after recovery uses `error.details.recovery` and does not add `currentRecovery`.

Fresh v4 success stores `schemaChanged: true` only when that execution wrote the v4 write set. A fresh matching v5 call stores no ledger row and returns `schemaChanged: false`.

`--dry-run` does not take the lock, does not recover, and writes nothing. A prepared journal stays in place. The dry-run result is `status: "dry_run"` when the token matches the current bytes.

`--recover-only` uses the same inspect-then-restore order, writes no schema, and appends no upgrade audit or ledger row. Combined with `--input` or `--dry-run` it is `USAGE` before the lock and does not recover. A missing token is not recover-only.

Lock busy stays `COMMIT_BUSY` for apply and recover-only.

Failure injection is an optional `onPhase` argument on the upgrade commit helper, not a CLI flag. Tests throw from these phases: `before-actions-rename`, `after-actions-rename`, `after-ledger-publication`, `before-committed-marker`, `after-committed-marker`. The phase after ledger publication and before the committed marker leaves the journal `prepared`. The next apply restores the ledger preimage, reloads, and does not report that publication as success.

### Wiring in the upgrade node

`src/commands.mjs`: export upgrade preview, apply, and recover-only by calling `src/model-upgrade.mjs`. In `doctor`, rethrow `VAULT_UPGRADE_REQUIRED` instead of folding it into `checks.model`. Exit 2 stays the degraded path, including uninitialized doctor. `doctor --integration` does not load the career model.

`src/cli.mjs`: routes and help.

- `model upgrade-preview`: `--json`, `--data-root`. Reject `--input`, `--dry-run`, and `--recover-only` as `USAGE`.
- `model upgrade-apply`: `--json`, `--data-root`, `--input`, `--dry-run`, `--recover-only`. The command rejects `--recover-only` combined with `--input` or `--dry-run` as `USAGE` before the lock.

`src/command-catalog.mjs`: `COMMAND_CONTRACTS` entries for both routes, invariants for the token, the empty v5 write set, `currentRecovery` on replay only, and no downgrade. Add `VAULT_UPGRADE_REQUIRED` and `PENDING_JOURNAL` to `ERROR_TAXONOMY`. Keep `routeNames()` and `commandNames()` in parity so `test/cli.test.mjs` stays green.

`ENTITY_TYPES` gains no `action` type in this node.

### Factories

v5 default writers, all in this node:

- `src/model.mjs` empty in-memory model
- `src/storage.mjs` manifest writer
- `test/fixtures/career-vault.mjs`
- the local fixture in `test/cli.test.mjs`
- `tempVault` in `test/opportunity-structured-fields.test.mjs`
- `makeFixture`, `requiredRecords`, and `recordFiles` in `scripts/c0-baseline.mjs`

Each ready vault writes `schema_version` 5, nine collection files including canonical empty `actions.json`, and nine counts. `test/cli.test.mjs` today asserts the eight-file `RECORD_FILES` list. This node updates that assertion to the nine-file list ending in `actions.json`.

`test/fixtures/vault-v4.mjs` is the dedicated legacy fixture. It is not used by ordinary command tests. It writes a consistent v4 vault: eight career files, no `actions.json`, eight counts, no `counts.actions`, plus a company, a person, a submission-bundle interaction, and an outreach transmission file whose bytes upgrade tests hash. It also exports a consistent v5 twin, same career and snapshot bytes, empty `actions.json`, nine counts, for tests that start on v5. The action node imports this fixture and does not edit it.

Before editing, the upgrade node re-reads the tree for other `schema_version: 4` ready-vault writers and eight-file assertions. Any writer of a ready manifest joins the v5 default set. The v4 fixture stays the only ready v4 writer.

`artifact bootstrap-snapshots` is unchanged as a command. On v5 it must not force version 4 or create a missing `actions.json`. The version stamp change in `outputs()` is what keeps it on version 5.

### Upgrade node tests

File: `test/model-upgrade.test.mjs`. Fixture: `test/fixtures/vault-v4.mjs`.

- Ordinary reads and writes on consistent v4, including `doctor`, a dry-run mutation, and the commands that already load the model, return `VAULT_UPGRADE_REQUIRED`, the preview-then-apply message, and the details object. Doctor's thrown error is the CLI error envelope and exit 1, not `status: "degraded"` and not exit 2. Hashes of the eight career files, snapshots, transmission bytes, audit, and ledger are unchanged. `actions.json` is not created.
- v4 with the eight files and no `actions.json` is not `MODEL_INCOMPLETE` for actions. v5 missing `actions.json` is `MODEL_INVALID` reason `actions_missing` and is not an empty action list. A missing career file after a recognized version stays `MODEL_INCOMPLETE`. A non-integer or other version is `MODEL_INVALID`.
- Uninitialized doctor and `VAULT_NOT_INITIALIZED` stay as they are. Preview and apply on an uninitialized root create no vault. The product tree as a data root stays `PRODUCT_TREE_NOT_DATA`.
- Preview writes nothing and does not lock. The token names `auditPrefixSha256`, `ledgerPreimage`, `currentIndexSha256`, and `projectedIndexSha256`. The write set excludes career files, snapshots, transmission bytes, and index deletion. A pending journal returns `PENDING_JOURNAL` and no token.
- A journal set whose later preimage escapes the vault restores no earlier preimage and writes no schema.
- Apply without a token does not recover. Apply of the v4 token creates canonical empty `actions.json` when absent, leaves that empty file unchanged when already present, sets version 5 and `counts.actions` 0, preserves the eight count values and the historical career, snapshot, submission-bundle, and transmission bytes, keeps the audit prefix, and appends one audit line. A second apply of a token previewed from that v5 vault writes nothing, including no ledger append.
- Replay of the committed upgrade returns the stored result before source-token comparison after the live fingerprint has changed. Stored `schemaChanged` and stored `recovery` stay as stored.
- Reproduction: stored row has `schemaChanged: true` and `recovery.performed: false`. A different prepared journal is present. Same digest preflights, recovers that journal, reloads the ledger, and replays. Response keeps stored `schemaChanged: true` and stored `recovery.performed: false`, sets `replayed: true`, and sets `currentRecovery` to `{ performed: true, journals: <count> }`. The ledger result bytes do not gain `currentRecovery`. A following `--recover-only` reports no remaining journal.
- Conflicting reuse is `IDEMPOTENCY_CONFLICT` and writes nothing.
- Injected failure before and after the actions-file rename, after ledger publication but before the committed marker, and around the committed marker. The pre-commit crash rolls the ledger back, including a row published while the journal was still `prepared`, and does not report success. Retry after that recovery is a fresh execution.
- Stale preview and stale token on a new idempotency key are `STALE_REVISION` with `error.details.recovery` when recovery already ran, and schema bytes stay unchanged.
- Dry-run beside a prepared journal leaves the journal and writes nothing. Lock busy is `COMMIT_BUSY`.
- `--recover-only` recovers a supported journal, writes no schema, and appends no upgrade audit line. A v4 vault stays v4.
- Default factories used by ordinary tests write version 5. `routeNames()` has no init command. Read-only upgrade preview creates no files.
- `artifact bootstrap-snapshots` on the v5 twin does not write version 4 and does not create `actions.json` when that file is already the canonical empty array. It does not add the file when the test removes it: load fails `MODEL_INVALID` first.

This node ends with `npm test` green. Action commands are not in the route table yet.

## Action node

Starts only after the upgrade node is finished. Creates `src/actions.mjs` and no other new source module. Does not edit `src/model-upgrade.mjs`, `src/model.mjs`, `src/storage.mjs`, or the factories.

`src/actions.mjs` owns `plan`, `wait`, `unwait`, `update`, `reschedule`, `complete`, `cancel`, `list`, and `get`, plus action validation, the completion event-match, and `contactClock(interaction)`.

`contactClock` is a pure function of one stored interaction. It returns `outbound`, `inbound`, or `unknown`. `recordInteraction` and `recordOutreachSent` in `src/commands.mjs` call it. They do not keep a second copy of the kind rule. The action node adds that call. The upgrade node does not.

Stored records are snake_case. Payloads are camelCase, using the map in the acceptance doc. Status, category, and kind tokens are lowercase on both sides.

Lifecycle, immutability, provenance, dates, subjects, and attribution follow the acceptance doc. Attribution calls the same association checks as `applyStrategyAttribution` in `src/commands.mjs` and skips the `STRATEGY_NOT_ACTIVE` and `EXPERIMENT_NOT_RUNNING` branches. `experimentId` requires a `cohortId` that is a member of that experiment's `cohorts`. `cohortId` without `experimentId` is `INVALID_COMMAND`. Named strategies must exist. When an experiment is present, each named strategy id must appear in that experiment's `strategy_ids`.

External completion matches the cited interaction's own foreign keys. Derived backlink arrays are not the match. Kind must equal `expected_kind`. `evidence_state` must be `confirmed`. Direction is not required. A parseable `occurred_at` is not required when the stored confirmed row already supports that the event occurred. `interaction record` still requires `occurred_at` on a new confirmed interaction. `completedAt` comes from the payload.

Internal completion accepts a nonempty `result`, an artifact whose `owner_id` or `subject_ids` contains a subject id, or both. An `interactionId` on an internal complete is `INVALID_COMMAND` and does not move clocks. Completion does not insert an interaction and does not change `lifecycle_status` or `pursuit_status`.

`outreach record-sent` stores kind `outreach` and direction `outbound`. Omitted direction and explicit `outbound` both store `outbound`. Any other caller direction is `INVALID_COMMAND` and writes nothing. `interaction record` accepts payload `direction` only for the closed contact-kind set. `application-attempt record-submission` rejects a supplied `direction` before `mutate` and does not feed clocks. Historical rows are not rewritten.

`entity upsert` stays unable to write an action. `ENTITY_TYPES` gains no `action` key. `get --id` does not grow an action branch. Lookup is `action list` and `action get`.

`action list` and `action get` are lock-free, call the rejecting `loadModel`, write nothing, and do not create `actions.json`. List returns the stored array in file order. Get returns one record or `NOT_FOUND`. A missing `--id` is `USAGE`. No filter option is added.

### Routes, catalog, and help in the action node

Add these routes to `src/cli.mjs` `ROUTES`, `help()`, and `COMMAND_CONTRACTS` in the same node so the capabilities parity test stays green:

| Route | Options |
| --- | --- |
| `action plan` | `--json`, `--data-root`, `--input`, `--dry-run` |
| `action wait` | same |
| `action unwait` | same |
| `action update` | same |
| `action reschedule` | same |
| `action complete` | same |
| `action cancel` | same |
| `action list` | `--json`, `--data-root` |
| `action get` | `--json`, `--data-root`, `--id` |

Catalog payload schemas use the camelCase fields and the lowercase enums. `interaction record` gains optional `direction` with enum `outbound` | `inbound`. `outreach record-sent` gains optional `direction` with the same enum, and the invariant that only `outbound` is stored. `application-attempt record-submission` does not gain a direction property; a supplied direction is still `INVALID_COMMAND` because the command rejects unknown payload behavior rather than ignoring it. The catalog invariant for that command says a supplied `direction` is rejected and clocks are unchanged.

Help lists `action list` and `action get` with the read-only commands, and the seven mutations with the mutation commands.

Action history `command` values are the route names, such as `action plan`.

### Action node tests

File: `test/actions.test.mjs`. Ordinary setups use the v5 `career-vault` fixture. Upgrade-gate and hash cases that need the rich v4 shape import `test/fixtures/vault-v4.mjs` and do not modify it. The "company with no vacancy" case uses `company:acme` alone as the subject list. It does not delete the fixture's opportunity.

Behavior:

- Plan `external_contact` with `expectedKind` `outreach` against the company alone. `outreach record-sent` stores kind `outreach` and direction `outbound`. Complete against that interaction. Plan a continuation. Completing the first leaves the continuation open.
- A confirmed `conversation` with no `direction` completes an action whose `expected_kind` is `conversation`. `contactClock` stays `unknown` for that row, including when `occurred_at` is absent on a stored confirmed row. Neither clock moves. The test classifies the stored interaction. It does not expect new `pipeline status` fields.
- Internal completion with a result, with a linked artifact, and with both, does not insert an interaction, does not change `lifecycle_status` or `pursuit_status`, and does not move the outbound clock. An interaction id on that complete is `INVALID_COMMAND`.
- One interaction cited by two actions completes only the action that was commanded.
- `entity upsert` with type `action` does not write an action. Terminal `completed` and `cancelled` reject later commands with `INVALID_TRANSITION`. `unwait` returns `waiting` to `open` and keeps due date, note, category, subjects, expected kind, and history.
- A person subject does not write `company_id` or company membership on the person.
- Contradictory direction on `outreach record-sent` is rejected and writes nothing. Direction on `note`, `application_outcome`, `opportunity_decision`, `strategy_gate_decision`, and `submission` is rejected. Those rows stay out of both clocks.
- Undirected `outreach` and `outreach_sent` with a real `occurred_at` and `evidence_state` `confirmed` classify as outbound. Explicit direction wins over kind. A contact kind without a real `occurred_at`, and an unconfirmed row, stay `unknown`.
- Reject duplicate subjects, unknown subjects, a company-only subject left uncovered by the interaction, kind mismatch, impossible calendar dates, an empty objective, an internal plan that supplies `expectedKind`, and an external plan that omits it.
- `experimentId` without a belonging `cohortId`, and `cohortId` without `experimentId`, are `INVALID_COMMAND`. A draft strategy and a draft experiment may still be stored. The call does not raise `STRATEGY_NOT_ACTIVE` or `EXPERIMENT_NOT_RUNNING`.
- Idempotency replay of an action returns the stored success before `expectedRevision` is checked. A new key with a stale `expectedRevision` is `STALE_REVISION` and writes nothing. `plan` rejects a supplied `expectedRevision`.
- Dry-run writes nothing.

Read-only test list in the same file:

- `action list` returns the stored array in file order: `{ schemaVersion: 1, status: 'ok', actions }`.
- `action get --id` returns `{ schemaVersion: 1, status: 'ok', action }` or `NOT_FOUND`.
- A missing `--id` is `USAGE`. An extra filter option is `USAGE`.
- On consistent v4, both commands return `VAULT_UPGRADE_REQUIRED` and create no file. Career, snapshot, audit, and ledger hashes stay unchanged.
- On v5 with `actions.json` removed, both return `MODEL_INVALID` and leave the file absent.
- When the records directory is absent, list returns an empty `actions` array, get returns `NOT_FOUND`, and neither creates a file.
- With the commit lock held, both still succeed and do not return `COMMIT_BUSY`.
- The product tree as a data root is `PRODUCT_TREE_NOT_DATA`.
- `command describe` for `action list` and `action get` matches the catalog: read-only, the options above, no filter.

This node ends with `npm test` green.

## Docs node

Starts only after the action node is finished. Edits operator docs only, plus the new doc assertion test. It does not edit shared source files, factories, or skills.

`docs/cli.md`:

- Commands and JSON examples for `model upgrade-preview`, `model upgrade-apply`, `model upgrade-apply --recover-only`, every `action` route including `action list` and `action get`, and optional `direction` on `interaction record` and `outreach record-sent`.
- The preview-then-apply instruction, `VAULT_UPGRADE_REQUIRED`, and `PENDING_JOURNAL`.
- No downgrade command. A previous binary can force version 4 and eight counts on a v5 vault. This product does not repair that.
- Vault `schema_version` 5 is not a submission-bundle version. Submission bundles stay on their own evidence versions.
- Torn multi-file reads: lock-free reads, including `model upgrade-preview`, `action list`, `action get`, `pipeline status`, and `readiness`, can observe a torn read while a locked mutation writes files one at a time. A torn read is not a successful upgrade and is not a reason to create `actions.json`.
- Completion is an event match or internal evidence. Direction and a clock-usable time are clock classification, not completion evidence.

`docs/data-layout.md`:

- Nine collections. `actions.json` is the ninth. On an existing vault it is part of the live model only after the explicit upgrade.
- Manifest `schema_version` 5 and `counts.actions`.
- The same torn-read paragraph, the old-binary risk, and the statement that vault version 5 is not a submission-bundle version.
- No action backlinks on parent career files or index pages.

`docs/architecture.md`:

- Planned actions are not interactions, application closes, or strategy terminals.
- Upgrade is preview then apply. Recover-only is not a forgotten token.
- Contact clocks are derived. Direction exists only on the closed contact-kind set, on rows written from this change forward.
- The same torn-read paragraph.

`test/issue-23-docs.test.mjs` reads those three files and asserts they mention `model upgrade-preview`, `model upgrade-apply`, `action list`, `action get`, `VAULT_UPGRADE_REQUIRED`, no downgrade, the old-binary risk, vault version 5 distinct from submission-bundle versions, and torn multi-file reads for preview, list, and get. The test does not parse the product vault and does not create a data root.

This node ends with `npm test` green.

## Command contract the tests assert

Replay success, and only replay success, adds:

```json
{
  "replayed": true,
  "schemaChanged": true,
  "recovery": { "performed": false, "journals": 0 },
  "currentRecovery": { "performed": true, "journals": 1 }
}
```

`schemaChanged` and `recovery` in that example are the stored historical values. `currentRecovery` is this invocation. Tests that store a different historical `recovery` assert that stored object unchanged and assert `currentRecovery` separately.

Fresh apply success:

```json
{
  "schemaVersion": 1,
  "status": "applied",
  "recovery": { "performed": false, "journals": 0 },
  "schemaChanged": true
}
```

Recover-only success:

```json
{
  "schemaVersion": 1,
  "status": "ok",
  "recovery": { "performed": false, "journals": 0 },
  "schemaChanged": false
}
```

`action list` success is `{ "schemaVersion": 1, "status": "ok", "actions": [] }`. `action get` success is `{ "schemaVersion": 1, "status": "ok", "action": {} }`.

## Non-goals for every later node

- Issues #24 and #25.
- Skill-source edits. Shared skill files wait for Issue 3.
- A public init command, a downgrade command, a clock command, or a history rewrite.
- Action backlinks, index pages for actions, or an `action` type on `entity upsert`.
- Filters on `action list` or `action get`.
- Envelope or existing-command output changes owned by issue #17, except optional `direction` on eligible `interaction record` kinds and the stored outbound direction on `outreach record-sent`.
- Changing ordinary `mutate` recovery so that it inspects every journal before restoring. Upgrade uses the new inspect-then-restore functions. Ordinary `mutate` stays on `recoverTransactions`.
- Marking the acceptance doc, the ADR, or this plan accepted.

## Stop

ORIGIN STOP: after the planner node that writes this file, do not dispatch node 4 or any later node, even if graph edges are ready. First collect an independent Codex review of the proposed acceptance doc, ADR 014, and this plan from outside the Grok workers. Human graph acceptance does not pre-accept this design. Resolve findings by a later correction node that receives the Codex packet. Record design acceptance only after that review and any correction. Do not implement product code from this plan until that gate is recorded.
