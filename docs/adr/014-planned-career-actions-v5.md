# ADR 014 — Planned career actions and vault schema v5

**Status:** accepted

**Date:** 2026-10-21

**Issue:** [#23](https://github.com/smota/nextstep/issues/23) — feat: add planned career actions with an explicit v4 to v5 upgrade

**Acceptance doc:** [issue-23-planned-career-actions.md](../plans/issue-23-planned-career-actions.md) (status accepted). That file is an input. It is not a completed product-manager or analyst pass.

Design acceptance is recorded by graph node 4 under the origin authority receipt for candidate `5c1fe87d364ed5285d3707f5645b67882cb438f0`, after the final independent Codex PASS. This ADR does not invent that authority. Human graph acceptance does not accept this ADR. Human delivery acceptance remains the integration gate and is still pending. Origin collects and verifies the architect pass. This file does not mean the architect role has passed. It is not reviewer sign-off and not PR readiness.

Profile: `high-assurance`. Surfaces: data, service, docs.

## Context

The vault is eight collections and manifest `schema_version` 4. `src/model.mjs` loads those collections and ignores the manifest version. A missing collection file fails as `MODEL_INCOMPLETE`. `src/storage.mjs` rewrites the manifest as `schema_version` 4 and eight counts on ordinary mutation. There is no action store, no action lifecycle, and no stored contact direction.

A planned next step is not an interaction, an application close, or a strategy or experiment terminal. Completion must leave the interaction log and `lifecycle_status` / `pursuit_status` as they were. Strategy or experiment attribution is not execution. Generic `entity upsert` drops omitted fields, and its type map has no action type, so action fields need their own commands.

A new required collection on today's load would reject every current vault. The collection arrives only through an explicit upgrade. Release intent is one change: the upgrade, the action commands, the completion event-match, the contact-clock direction rules, catalog schemas, examples, and operator docs. Ready-vault factories that synthesize a new vault write `schema_version` 5. Vaults that already exist stay on version 4 until `model upgrade-preview` and `model upgrade-apply`.

Submission-bundle `schema_version` values 2, 3, and 4 are evidence versions on an interaction. They are independent of the vault manifest version.

## Decision

`actions` is the ninth required collection. The id prefix is `action`. The file is `actions.json`. On a vault that already exists, that file is part of the live model only after an explicit upgrade. `RECORD_TYPES`, `RECORD_FILES`, id prefixes, `counts`, and the in-memory empty model include it. Append `actions` after the existing eight types so the current order stays stable. `counts.actions` is the manifest key.

Ready-vault factories write `schema_version` 5, nine files including an empty `actions.json`, and nine counts. The canonical empty array is the product JSON helper form: `[]` followed by a newline. The uninitialized missing-records short-circuit may include an in-memory empty `actions` array and must not write a vault. Uninitialized roots keep today's doctor and `VAULT_NOT_INITIALIZED` behavior. Upgrade does not create a vault.

Ordinary v5 mutations keep version 5 and the actions count. They must not create `actions.json` as a side effect of some other write. The manifest writer must not stamp `schema_version` 4. `artifact bootstrap-snapshots` stays a snapshot tool and, on a v5 vault, must not force version 4 or invent `actions.json`.

Parent career files and generated index pages do not gain action backlinks. `renderIndexes` does not grow an actions catalog page for this issue. `entity upsert` cannot create or replace an action. `ENTITY_TYPES` gains no `action` type.

Vault `schema_version` 5 is not a submission-bundle version. No downgrade command exists. A previous binary on v5 can force version 4 and eight counts. Docs state that risk. This issue does not rewrite history to repair it.

There is no new public init command.

### Version gate

Version is an integer. Only `4` and `5` are recognized. The check happens before the generic missing-file error.

`src/model.mjs` remains the collection registry, load gate, and model validator. Ordinary consistent v4 reads and writes, including doctor, dry-run, `action list`, and `action get`, reject with `VAULT_UPGRADE_REQUIRED` and the preview-then-apply instruction, write nothing, and do not report that case as a degraded success. Doctor throws that error. The CLI prints the error envelope on stderr and exits 1. Exit 2 remains the exit for a real degraded report, including today's uninitialized doctor. `doctor --integration` stays an integration report. It does not load the career model and is not the upgrade gate.

A consistent v4 vault is manifest `schema_version` 4, eight readable collection arrays, and eight agreeing counts. `actions.json` is absent, or present only as the canonical empty array with no `counts.actions`. Ordinary commands still reject that vault. They do not treat the missing file, or that empty file, as the live action collection. A v4 tree with any other `actions.json`, with an `actions` count, with unreadable records, or with disagreeing eight-counts is malformed (`MODEL_INVALID`). Preview does not issue a token for it.

A v5 vault whose `actions.json` is missing or whose `counts.actions` disagrees with the actions array is malformed (`MODEL_INVALID`). A missing `actions.json` is not an empty collection and is not `MODEL_INCOMPLETE`. After the version check, a missing file among the eight career collections is still `MODEL_INCOMPLETE`.

The v4 rejection is not used for `model upgrade-preview` on a consistent v4 or v5 vault, `model upgrade-apply` with a matching token, `model upgrade-apply --recover-only`, commands that never load the career vault, an uninitialized root, or the product tree used as a data root (`PRODUCT_TREE_NOT_DATA`).

Ordinary v5 reads require version 5 and a present actions array and write nothing. When the records directory is absent, `action list` returns an empty `actions` array and `action get` returns `NOT_FOUND`, and neither creates a file.

The upgrade module needs a reader that can see a consistent v4 vault. That reader lives with the upgrade module or is an explicit load-gate mode that does not throw `VAULT_UPGRADE_REQUIRED`. Ordinary commands keep using the rejecting load.

Ordinary `mutate` and `dryRunMutation` classify that live vault before `recoverTransactions` and before a ledger replay. A consistent v4 result is `VAULT_UPGRADE_REQUIRED` with no restore and no stored-success return, including when the digest already matches and including when a prepared journal is present. A consistent v5 ordinary mutation may then use the existing recovery and replay. Upgrade apply does not use that ordinary order.

### Modules later nodes must keep

`src/model-upgrade.mjs` owns preview, apply, and recover-only, including the token, journal preflight, recovery, replay, and write set. It does not own action records, action validation, the completion event-match, or the direction classifier. Graph node 6 is the only node that creates this file.

`src/actions.mjs` owns `plan`, `wait`, `unwait`, `update`, `reschedule`, `complete`, `cancel`, `list`, and `get`, plus action validation, the completion event-match, and the contact-clock direction classifier used by `interaction record` and `outreach record-sent`. Graph node 7 is the only node that creates this file. The classifier is a pure function of one stored interaction. Its result is `outbound`, `inbound`, or `unknown`. `interaction record` and `outreach record-sent` call that function. They do not keep a second copy of the kind rule.

`validateModel` calls `validateActions(model, errors)` exported from `src/actions.mjs`. That function checks stored action structure: id prefix, required fields, enums, subjects, dates, category, and `expected_kind`. It does not call `validateModel` or `loadModel`, and it does not apply status transitions. Transitions stay in the action commands. Graph node 7 adds this call. Graph node 5 only accepts `action:` ids and an empty actions array through the generic collection loop.

`src/commands.mjs`, `src/cli.mjs`, and `src/command-catalog.mjs` wire those modules into routes, help, `COMMAND_CONTRACTS`, and `ERROR_TAXONOMY`. They do not grow a second implementation of the upgrade write set or the completion match.

`src/storage.mjs` remains the lock, journal, manifest, and index writer used by the upgrade module. Neither `src/model.mjs` nor `src/storage.mjs` becomes the owner of action lifecycle rules. Ordinary `mutate` gains the version guard in graph node 5. Upgrade journal inspect-and-restore is added in graph node 6 and is not `recoverTransactions`.

Shared files `src/model.mjs`, `src/storage.mjs`, `src/commands.mjs`, `src/cli.mjs`, `src/command-catalog.mjs`, and the ready-vault factories stay serialized across graph nodes 5, 6, and 7. Node 5 owns the factories and `scripts/c0-baseline.mjs`. Node 6 does not edit that script.

### Frozen commands

| Command | Boundary |
| --- | --- |
| `model upgrade-preview` | Lock-free read. Writes nothing. Options: `--json`, `--data-root`. |
| `model upgrade-apply` | Locked mutation. Requires `--input`. Supports `--dry-run`. Options: `--json`, `--data-root`, `--input`, `--dry-run`. |
| `model upgrade-apply --recover-only` | Locked recovery mode. Options: `--json`, `--data-root`, `--recover-only`. |
| `action plan` | Locked mutation. `--input`, optional `--dry-run`. |
| `action wait` | Locked mutation. `--input`, optional `--dry-run`. |
| `action unwait` | Locked mutation. `--input`, optional `--dry-run`. |
| `action update` | Locked mutation. `--input`, optional `--dry-run`. |
| `action reschedule` | Locked mutation. `--input`, optional `--dry-run`. |
| `action complete` | Locked mutation. `--input`, optional `--dry-run`. |
| `action cancel` | Locked mutation. `--input`, optional `--dry-run`. |
| `action list` | Lock-free read. Options: `--json`, `--data-root`. Returns the stored actions. |
| `action get` | Lock-free read. Options: `--json`, `--data-root`, `--id`. Returns one action by id or `NOT_FOUND`. |

An unsupported option is `USAGE`. `--recover-only` combined with `--input` or `--dry-run` is `USAGE` and writes nothing, including no recovery. Preview rejects `--input`, `--dry-run`, and `--recover-only` as `USAGE`.

`action list` and `action get` are lock-free, write nothing, do not create `actions.json`, and use the same v4 rejection as other ordinary reads. They add no filters and no new output schema beyond the stored record and the existing read envelope. List returns `{ "schemaVersion": 1, "status": "ok", "actions": [] }` in file order. Get returns `{ "schemaVersion": 1, "status": "ok", "action": {} }`. A missing `--id` is `USAGE`.

### Upgrade preview

Preview is lock-free and writes nothing. It does not take the commit lock, so a held lock is not `COMMIT_BUSY` on preview. It accepts only a consistent v4 vault or a consistent v5 vault. It rejects a malformed version, unreadable records, and any pending domain journal. A pending journal is `PENDING_JOURNAL` and no token is issued.

Success is `{ "schemaVersion": 1, "status": "ok", "token": {} }`. The token is a JSON object. Digests are SHA-256 values the product already computes.

- `schemaVersion`: `1`
- `vaultSchemaVersion`: `4` or `5`
- `manifestSha256`
- `careerFileSha256`: the eight career filenames
- `actionsSha256`: `null` when `actions.json` is absent, otherwise that file's digest
- `snapshotAndTransmissionSha256`: vault-relative snapshot and transmission files
- `currentIndexSha256`: current index files
- `auditPrefixSha256`: digest of the current audit bytes; the empty digest when the audit file is absent
- `ledgerPreimage`: `{ "present": true, "sha256": "<digest>" }` or `{ "present": false, "sha256": null }`
- `writeSet`

`writeSet` for a v4 token:

- `actionsJson`: `"create-empty"` when `actions.json` is absent, or `"unchanged"` when it is already the canonical empty array
- `manifest`: `"rewrite-v5"`
- `projectedIndexSha256`: relative index path to the digest of the bytes `renderIndexes` would write for each index file whose bytes would change
- `ledger`: `"append-or-replace-record"`
- `audit`: `"append-one-line"`

`writeSet` for a v5 token uses `actionsJson: "unchanged"`, `manifest: "unchanged"`, `projectedIndexSha256: {}`, `ledger: "none"`, and `audit: "none"`.

The write set has no delete list. Stale index deletion is outside the write set. Career collection files and snapshot bytes are outside the write set. Transmission bytes are outside the write set.

### Upgrade apply

`--input` is the mutation envelope: `schemaVersion` `1`, `requestId`, `idempotencyKey`, optional `actor`, and `payload.token` equal to a preview token. A missing token, a missing envelope field, or `schemaVersion` other than `1` is `INVALID_COMMAND` or `INVALID_ENVELOPE` by the existing envelope rules, happens before the lock, and does not recover. A forgotten token is not `--recover-only`.

Under the lock the order is fixed:

1. Require a token. A missing token never reaches this list.
2. Preflight every journal path and state, including containment, before any recovery and before trusting or reloading the ledger.
3. An unsafe, unknown, or unreadable journal aborts the whole set with `UNSAFE_JOURNAL`. No journal is restored and no schema bytes are written.
4. Only a clean preflight may recover. `prepared` restores contained preimages. `committed` drops the journal. A ledger row published while the journal is still `prepared` is not success. Recovery restores that ledger preimage, so a crash after ledger publication and before the committed marker cannot replay as success.
5. Reload the ledger. The same idempotency digest returns the stored success before source-token comparison. A reused key with a different digest is `IDEMPOTENCY_CONFLICT` and writes nothing. Current-invocation recovery on that replay is top-level `currentRecovery`. It is not written into the stored result.
6. Otherwise recompute the fingerprint and refuse drift with `STALE_REVISION`. Drift writes no schema and reports this invocation's recovery separately in `error.details.recovery`.
7. A matching v4 token writes only the preview write set. The eight career files, snapshots, submission bundles, and transmission bytes stay byte-identical. The eight collection counts keep their values. The new manifest is `schema_version` 5, model `nextstep-opportunity-graph`, with `counts.actions` `0` and an empty `actions.json` array. Audit commit keeps the previous prefix and appends one line, using the existing audit-entry shape. The ledger gains or replaces that command's idempotency record.
8. A matching v5 token has an empty domain write set and writes nothing, including no ledger append and no audit line.

A fresh apply success uses the mutation response and adds `recovery` and `schemaChanged` for that execution. `recovery` there is what this call restored. `schemaChanged` is true only when this call wrote the v4 write set.

`--dry-run` writes nothing and recovers nothing. It returns `status: "dry_run"` when the token matches the current vault. A prepared journal beside a dry-run is left in place. Lock busy stays `COMMIT_BUSY`.

Action replay and `expectedRevision` stay separate from this upgrade replay. See the action lifecycle below.

#### Replay of a stored upgrade

The approved issue requires the same idempotency digest to return the stored success after recovery and ledger reload, and before source-token comparison. A vault a committed upgrade already changed still replays. The digest covers the envelope, including the token. A different token under the same key is a different digest.

Ordering on this path stays fixed: preflight, then recover, then reload the ledger, then the replay-or-conflict check, then source-token comparison only when the digest is not a stored match. Replay does not perform the historical schema write. `replayed: true` means this call did not write that upgrade again.

`schemaChanged` on a freshly stored success is true only when that execution wrote the v4 write set. A fresh matching v5 token stores nothing: it appends no ledger row, and its success body has `schemaChanged: false`.

Replay does not recompute `schemaChanged` from the live vault and does not clear it. Replay returns the stored success body and may add `replayed: true`, matching `mutate` in `src/storage.mjs`. A stored successful v4 upgrade contains `schemaChanged: true` and the `recovery` object stored for that original execution. Both stay as stored. This call does not merge journals it just restored into that historical `recovery` object, and it does not rewrite the ledger row to do so.

Current recovery is a separate fact. On a replay response, the historical `recovery` value can be `performed: false` while this call has just removed a different prepared journal. The finalized field is top-level `currentRecovery`. The shape has no other fields: `{ "performed": <boolean>, "journals": <integer >= 0> }`. `performed` is true exactly when `journals` is greater than zero. `journals` counts journal files this invocation restored (`prepared`) or dropped (`committed`). The field stays outside the stored-result meaning: it describes only journals this invocation restored or dropped, and it is not a second copy of historical `schemaChanged` or historical `recovery`. A fresh apply stores top-level `recovery` and does not add `currentRecovery`. Recover-only reports this invocation only through top-level `recovery` and does not add `currentRecovery`. A rejection after recovery uses `error.details.recovery` and does not add `currentRecovery`.

A caller of that replay can see the recovery that occurred. A later `--recover-only` cannot. The journals are already gone, so recover-only then reports no pending work. The replay response is the report of this invocation's recovery.

When recovery rolls the ledger back because the row was published while the journal was still `prepared`, there is no stored success to return. The next apply is a fresh execution. It must not report the rolled-back publication as success.

A new idempotency key that presents the old v4 token against a vault the upgrade already changed fails fingerprint comparison with `STALE_REVISION` and writes no schema. That path is drift, not replay.

### Recover-only

`model upgrade-apply --recover-only` locks, preflights every journal, recovers supported journals, writes no schema, and appends no upgrade audit line and no upgrade ledger record. It does not treat a ledger row from a still-prepared journal as success. It is how a pending journal is cleared when preview refuses a token. It is not what a forgotten token does.

Success:

```json
{
  "schemaVersion": 1,
  "status": "ok",
  "recovery": { "performed": false, "journals": 0 },
  "schemaChanged": false
}
```

`journals` counts journals recovered. A vault with no journal succeeds with `performed: false` and leaves schema and version untouched. A v4 vault stays v4.

On a fresh apply execution, `recovery.performed` is true when this call restored journals, including when `schemaChanged` is false. That `recovery` object is this invocation. A replay does not rewrite it over the stored object. `currentRecovery` carries this call's recovery on the replay response only. A rejection after recovery still uses `error.details.recovery` for this invocation and leaves schema bytes unchanged.

### Action records

Stored action fields are snake_case. CLI payloads are camelCase. Status, category, and kind tokens are lowercase enums on both sides.

| Payload | Stored |
| --- | --- |
| `expectedKind` | `expected_kind` |
| `dueOn` | `due_on` |
| `completedAt` | `completed_at` |
| `interactionId` | `interaction_id` |
| `artifactId` | `artifact_id` |
| `strategyIds` | `strategy_ids` |
| `experimentId` | `experiment_id` |
| `cohortId` | `cohort_id` |

`category` is required, nonempty, and caller-supplied: `internal` or `external_contact`. It is immutable. Subject type does not classify it.

`subjects` is a nonempty array of `{ "type", "id" }` for existing `company`, `person`, `opportunity`, or `application_attempt` ids. Duplicate `type`+`id` pairs are `INVALID_COMMAND`. Subjects are immutable. A company alone, or a person alone, is valid. A person subject does not write `company_id` and does not add company membership.

`external_contact` requires immutable `expectedKind` from `outreach`, `outreach_sent`, `outreach_response`, `human_response`, `conversation`, `interview`, `screen`. `internal` omits `expected_kind`. Supplying it on an internal plan is `INVALID_COMMAND`.

`objective` is required and nonempty. An update cannot make it empty.

Every action stores nonempty provenance: `actor`, `created_at`, `updated_at`, `source_revision`, and append-only `history`. `created_at` is set once from the command clock, the UTC timestamp the command layer already uses for audit `at` values. `updated_at` changes on every successful mutation. Both are real UTC date-times. `source_revision` starts at `0`. Each history entry is `{ "command", "at", "source_revision" }` for the revision stored after that mutation. `command` is the route name, such as `action plan`.

`due_on` is a real `YYYY-MM-DD` date or absent. Impossible calendar dates are `INVALID_COMMAND`.

Ids start with `action:`. A caller may supply `payload.id` with that prefix. Omitted ids are generated with that prefix. A duplicate id is `INVALID_COMMAND`.

#### Attribution keeps both association directions

Optional `strategyIds`, `experimentId`, and `cohortId` are attribution only. The approved issue retains the product's current association rules and drops the execution-status gates. Current `applyStrategyAttribution` requires a valid cohort whenever an experiment is supplied, and it requires an experiment whenever a cohort is supplied. Action attribution keeps both directions and does not apply `STRATEGY_NOT_ACTIVE` or `EXPERIMENT_NOT_RUNNING`.

- Each named strategy must exist. Absence is `NOT_FOUND`.
- `experimentId` requires a `cohortId` that is a member of that experiment's `cohorts`. A missing or unknown cohort is `INVALID_COMMAND`.
- `cohortId` without `experimentId` is `INVALID_COMMAND`.
- When an experiment is present, every named strategy id must appear in that experiment's `strategy_ids`. Otherwise `INVALID_COMMAND`.
- Named strategies without an experiment are existence checks only.
- Storing these fields does not count as execution, does not run strategy or experiment gates, and does not move clocks.

The acceptance doc states both association directions: `experimentId` requires a `cohortId` belonging to that experiment, and `cohortId` requires `experimentId`. Status gates stay excluded. The applied alignment is in "Scope alignment applied to the acceptance doc" below.

### Action lifecycle

| Command | From | To | Payload beyond the id |
| --- | --- | --- | --- |
| `action plan` | none | `open` | category, subjects, objective, and the optional fields above |
| `action wait` | `open` | `waiting` | none |
| `action unwait` | `waiting` | `open` | none; keeps due date, note, category, subjects, expected kind, and history |
| `action update` | `open` or `waiting` | same status | objective, note, or both; at least one |
| `action reschedule` | `open` or `waiting` | same status | `dueOn` as a date or `null` to clear |
| `action complete` | `open` or `waiting` | `completed` | `completedAt` plus the evidence below |
| `action cancel` | `open` or `waiting` | `cancelled` | nonempty `reason`, stored as `reason` |

`plan` rejects a supplied `expectedRevision` with `INVALID_COMMAND`. Every later action mutation requires envelope `expectedRevision`. A mismatch is `STALE_REVISION` with `details.currentRevision` and writes nothing. The same action idempotency digest returns the stored success before the revision check. A new key sees the live revision. That action replay is separate from upgrade replay.

`complete` and `cancel` are terminal. A later action command on `completed` or `cancelled` is `INVALID_TRANSITION` and writes nothing. `unwait` is the command that returns `waiting` to `open`.

`completedAt` is required on complete, is a real UTC date-time, and is stored from the payload. It is not copied from an interaction.

External completion is an event match, not a clock match. The cited interaction must already exist, have `evidence_state` `confirmed`, have `kind` equal to `expected_kind`, and cover every action subject on its own foreign keys: `company_id`, `person_ids`, `opportunity_id`, and `application_attempt_id`. Extra foreign keys may exist. Derived backlink arrays are not the match. A confirmed `conversation` or `interview` completes the action when its kind was the expected kind, including when `direction` is absent and when `occurred_at` is absent or unusable. Completion does not require direction. A missing interaction is `NOT_FOUND`. A present interaction that fails the match is `INVALID_COMMAND`.

Internal completion requires a nonempty `result`, an artifact id already linked to one of the subjects through that artifact's `owner_id` or `subject_ids`, or both. An interaction id on an internal complete is `INVALID_COMMAND` and does not move contact clocks. A missing artifact is `NOT_FOUND`. An artifact that exists and is not linked to a subject is `INVALID_COMMAND`.

Completion never inserts an interaction and never changes `lifecycle_status` or `pursuit_status`. One interaction may be cited by several actions. Completing one leaves the others open.

`note` on plan or update is a nonempty string, or `null` on update to clear it. Any other action field on update or reschedule is `INVALID_COMMAND`.

`interaction record` keeps its current rule that a confirmed interaction requires `occurred_at`. Completion can still match a stored confirmed interaction whose `occurred_at` is absent or unusable.

### Direction and contact clocks

Direction is stored only for the closed contact-kind set: `outreach`, `outreach_sent`, `outreach_response`, `human_response`, `conversation`, `interview`, `screen`. The stored field is `direction` with value `outbound` or `inbound`. Historical rows are not rewritten.

For a confirmed contact-kind interaction with a real `occurred_at`:

- explicit `outbound` or `inbound` selects that clock, and explicit direction wins over kind
- with no direction, kind `outreach` or `outreach_sent` selects outbound, as a kind match
- every other undirected contact kind stays unknown, including `conversation` and `interview`

Any other row stays unknown. That includes a non-contact kind, a contact kind without a real `occurred_at`, and an unconfirmed row. Non-contact kinds include `note`, `application_outcome`, `opportunity_decision`, and `strategy_gate_decision`, plus every other kind. Direction on those kinds is `INVALID_COMMAND`. They never enter either clock.

`outreach record-sent` stores kind `outreach` and direction `outbound`. Omitted direction and explicit `outbound` both store `outbound`. Any other caller direction is `INVALID_COMMAND` and writes nothing.

`interaction record` may set payload `direction` only with an eligible contact kind. The rest of that command's current confirmation rules stay in place. This optional direction input is the only existing-command input this issue adds.

`application-attempt record-submission` does not set direction and does not feed contact clocks. A supplied `direction` on that command is `INVALID_COMMAND` and writes nothing.

No clock command is added. Tests and callers observe clocks by classifying stored interaction records through existing reads. `pipeline status` and every other existing command output keep their current schema.

### Error codes

Existing codes keep their current meaning. This issue adds `VAULT_UPGRADE_REQUIRED`, `PENDING_JOURNAL`, and `JOURNAL_CLEANUP_FAILED`.

| Code | When |
| --- | --- |
| `VAULT_UPGRADE_REQUIRED` | Consistent v4 vault on an ordinary read or write, including doctor, dry-run, `action list`, and `action get`. |
| `PENDING_JOURNAL` | Preview sees a readable pending domain journal. No token is issued. |
| `MODEL_INVALID` | Version other than integer 4 or 5; v4 with a non-empty `actions.json` or an actions count; v5 with missing `actions.json` or disagreeing `counts.actions`; unreadable JSON. |
| `MODEL_INCOMPLETE` | After the version check, a missing file among the eight career collections. |
| `UNSAFE_JOURNAL` | Unsafe, unknown, or unreadable journal. No preimage in the set is restored. No schema write. |
| `JOURNAL_CLEANUP_FAILED` | The committed marker is durable and deleting that journal then throws. Published bytes and the ledger success row stay. The journal remains `committed` for recovery. This call is an error, not `applied`, and it is not rollback. |
| `STALE_REVISION` | Upgrade token no longer matches after recovery on a new idempotency key, or an action `expectedRevision` does not match on a new idempotency key. |
| `IDEMPOTENCY_CONFLICT` | Reused key with a different digest. Writes nothing. |
| `COMMIT_BUSY` | Apply or recover-only while the commit lock is held. |
| `INVALID_ENVELOPE` | Mutation `schemaVersion` is not 1, or `requestId` / `idempotencyKey` is missing on a mutation that requires them. |
| `INVALID_COMMAND` | Payload breaks the command contract, including a missing upgrade token, bad category, empty objective, duplicate subjects, impossible dates, kind mismatch, uncovered subjects, internal completion that passes an interaction, direction on a non-contact kind, contradictory `outreach record-sent` direction, or an experiment/cohort pair that breaks the association rules above. |
| `INVALID_TRANSITION` | Action status change is not in the lifecycle table. |
| `NOT_FOUND` | `action get` id is absent, or a cited subject, interaction, artifact, strategy, or experiment does not exist. |
| `USAGE` | Unknown route or unsupported option, including combining `--recover-only` with `--input`. |
| `VAULT_NOT_INITIALIZED` | Mutation, preview, or apply on an uninitialized root. |
| `PRODUCT_TREE_NOT_DATA` | Product tree supplied as the data root. |

`VAULT_UPGRADE_REQUIRED` message:

`Vault schema_version 4 requires an explicit upgrade. Run model upgrade-preview, then model upgrade-apply with that token.`

Details: `{ "schemaVersion": 4, "previewCommand": "model upgrade-preview", "applyCommand": "model upgrade-apply" }`.

`PENDING_JOURNAL` details include `{ "recoverCommand": "model upgrade-apply --recover-only" }`.

`MODEL_INVALID` details include `reason`: `schema_version`, `unexpected_actions`, `actions_missing`, `actions_count`, or `unreadable`.

`UNSAFE_JOURNAL` details include `reason`: `unsafe`, `unknown`, or `unreadable`.

When apply or recover-only has already restored bytes and then rejects, `error.details.recovery` is `{ "performed": true, "journals": <number> }` and schema bytes are unchanged.

Action attribution does not raise `STRATEGY_NOT_ACTIVE` or `EXPERIMENT_NOT_RUNNING`.

### Acceptance criteria carried forward

Later implementation and docs nodes keep the pass/fail checks in the accepted acceptance doc. In summary:

1. On a consistent v4 vault, ordinary vault commands, including `doctor`, `--dry-run`, `action list`, and `action get`, exit through the error envelope with `VAULT_UPGRADE_REQUIRED`, the preview-then-apply message, and the details above. Career files, snapshots, audit, and the ledger keep their hashes. `actions.json` is not created. Doctor does not return `status: "degraded"` for this case and does not exit 2. The live vault is classified before recovery and before replay. A matching ledger entry still does not return the stored success. A prepared journal stays in place and its preimages are not restored.
2. A v4 vault with the eight files present and `actions.json` absent does not report `MODEL_INCOMPLETE` for actions. A v5 vault with `actions.json` absent or with `counts.actions` disagreeing reports `MODEL_INVALID` and is not returned as an empty action list. A missing file among the eight career collections, after a recognized version, remains `MODEL_INCOMPLETE`.
3. Any manifest version other than integer 4 or 5 is `MODEL_INVALID`. Uninitialized roots still return today's uninitialized doctor and `VAULT_NOT_INITIALIZED` on mutation. Preview and apply on an uninitialized root create no vault.
4. `model upgrade-preview` writes nothing and does not take the lock. Its token names the audit prefix, the ledger preimage, the current index bytes, and the projected index bytes, and its write set excludes career collection files, snapshot bytes, transmission bytes, and index deletion. A pending journal returns `PENDING_JOURNAL` and no token. A journal set whose later path escapes the vault restores no earlier preimage.
5. Apply without a token returns an error and does not recover. Apply of the v4 token moves the manifest to version 5 with `counts.actions` 0, creates the canonical empty `actions.json` when it was absent, and leaves those bytes unchanged when they were already that empty array. It preserves historical career bytes, snapshots, submission bundles, transmission bytes, and the eight counts, keeps the audit prefix, and appends one audit line. A second apply of a token previewed from that v5 vault writes nothing, including no ledger append.
6. Replay of a committed upgrade returns the stored result after recovery and before source-token comparison, including when the live fingerprint has changed. The stored `schemaChanged` and stored `recovery` remain the historical values, with `replayed: true`. Replay does not perform the historical schema write. The same response reports this invocation's recovery in top-level `currentRecovery` and does not write that field into the ledger result. A conflicting key is `IDEMPOTENCY_CONFLICT` and writes nothing. A crash after the ledger write and before the committed marker rolls the ledger back on recovery and does not report success. `--recover-only` recovers a supported journal, writes no schema, and appends no upgrade audit line. Drift or another rejection after recovery changes no schema and reports this invocation's recovery in `error.details.recovery`, separate from schema change.
7. Reproduction for `currentRecovery`. A surviving committed upgrade ledger row stores `schemaChanged: true` and `recovery.performed: false`. A different prepared journal is also present. Apply with the same digest preflights, recovers that other journal, reloads the ledger, and replays before source-token comparison. The response keeps the stored `schemaChanged: true` and stored `recovery.performed: false`, sets `replayed: true`, and sets `currentRecovery` to `{ "performed": true, "journals": <recovered count> }`. This call does not rewrite the ledger row's stored result and does not apply the historical upgrade write set again. A following `--recover-only` finds the journal already removed and reports that no journal remained. The caller does not need that follow-up to learn that the replay invocation recovered the journal.
8. `--dry-run` on apply and on action commands writes nothing. Dry-run beside a prepared journal leaves that journal in place. Lock busy remains `COMMIT_BUSY`.
9. Default ready-vault factories emit `schema_version` 5, nine collection files including empty `actions.json`, and nine counts. The observed writers are `src/model.mjs`, `src/storage.mjs`, `test/fixtures/career-vault.mjs`, `test/cli.test.mjs`, `test/opportunity-structured-fields.test.mjs`, and `scripts/c0-baseline.mjs`, plus every other helper or test that writes a ready manifest or asserts the eight-file set. A dedicated v4 fixture drives upgrade tests. No new init command exists. `artifact bootstrap-snapshots` on v5 does not force version 4 or invent `actions.json`.
10. Company with no vacancy: the subject company has no opportunity and no application attempt. `company:acme` in `test/fixtures/career-vault.mjs` is not that company, because that fixture already has `opportunity:acme-lead`. The test creates a synthetic company, then `action plan` an `external_contact` with `expectedKind` `outreach`, records confirmed outbound through `outreach record-sent`, `action complete`s against that interaction, and `action plan`s a continuation that stays open. A person-only plan succeeds, and that person record keeps its previous `company_id` and company membership unchanged. A confirmed `conversation` with no direction completes an action whose expected kind is `conversation` and moves neither clock, including when `occurred_at` is absent or unusable on a stored confirmed row. Internal completion does not move the outbound clock, does not add an interaction, and does not change application lifecycle. Completion evidence is the event match, the internal result, or the linked artifact. Direction and a clock-usable `occurred_at` are not completion evidence.
11. `entity upsert` cannot write an action. Terminal states stay terminal. `unwait` returns `waiting` to `open` and keeps due date, note, category, and history. A person subject does not attach a company. Contradictory direction on `outreach record-sent` is rejected. Direction on a note, outcome, or other non-contact kind is rejected. `application-attempt record-submission` does not store direction. `experimentId` without a cohort that belongs to that experiment is `INVALID_COMMAND`. `cohortId` without `experimentId` is `INVALID_COMMAND`. Neither pair applies `STRATEGY_NOT_ACTIVE` or `EXPERIMENT_NOT_RUNNING`.
12. `action list` returns the stored actions. `action get` returns one stored action or `NOT_FOUND`. Neither accepts a filter, neither creates `actions.json`, and both are lock-free. Both are routes, catalog entries, help lines, operator docs, and read-only tests.
13. Discovery matches the shipped schemas for every frozen command, including `action list` and `action get`, the camelCase payload map, optional `direction` on eligible `interaction record` kinds, `VAULT_UPGRADE_REQUIRED`, `PENDING_JOURNAL`, the `currentRecovery` replay field, no downgrade command, and the old-binary risk. `test/planned-actions-discovery.test.mjs` compares command discovery and `docs/cli.md` examples with `COMMAND_CONTRACTS`. It does not stop at a prose mention. Operator docs state that vault version 5 is not a submission-bundle version and that a previous binary can force version 4 and eight counts. `docs/cli.md`, `docs/data-layout.md`, and `docs/architecture.md` state that lock-free reads, including `model upgrade-preview`, `action list`, and `action get`, can observe a torn multi-file read while a locked mutation writes files one at a time. A torn read is not a successful upgrade and is not a reason to create `actions.json`. `docs/stack-conventions.md` changes only the architect checklist sentence that says a new required collection should prefer an optional file outside `RECORD_TYPES`. That sentence points at this explicit upgrade.
14. Tests use synthetic v4 and v5 fixtures with a company, a person, a submission bundle, and an outreach transmission. They hash career files, snapshots, the audit prefix, the ledger, indexes, and counts around preview, rejected apply, recovery, and ordinary v4 reads. Failure injection distinguishes rollback before the committed marker from publication after it. A thrown exception before the marker is handled rollback: the restore catch runs only while the journal is still `prepared`, restores preimages, and deletes that journal. The caller sees the original error, not success. An abrupt pre-commit interruption is not that catch. The test leaves the journal `prepared` after ledger publication and before the committed marker, without running the restore catch. Restart restores the ledger preimage and does not report that publication as success. An abrupt post-commit interruption leaves the journal `committed`. Restart drops that journal, keeps the published bytes, and replays the stored success. A handled cleanup exception after the marker is a separate case. Journal deletion throws after the committed marker is durable. The restore catch does not run. Published schema bytes and the ledger success row stay. The journal file stays `committed`. The call returns `JOURNAL_CLEANUP_FAILED` with details `{ "committed": true, "publication": "preserved", "journalState": "committed" }`. It does not return `status` `applied` and it does not restore preimages. If that deletion actually finishes, the journal is gone and the call returns the normal apply success instead. Restart then drops a remaining committed journal without restoring preimages, leaves the published bytes in place, and replays the stored success. They cover retry, replay only after recovery and before source-token comparison, conflicting reuse, stale preview, stale revision, lock busy, and dry-run beside a prepared journal. They reject bad subjects, uncovered links, kind mismatch, impossible dates, internal completion that passes an interaction, and direction on non-contact kinds. They assert the product tree is not a data root, that read-only commands create no files, and that factories used by ordinary tests write version 5.

### Scope alignment applied to the acceptance doc

The implementation-planner node aligned `docs/plans/issue-23-planned-career-actions.md` with this ADR and with issue #23. Both documents are accepted under the origin authority recorded by graph node 4. The alignments do not add behavior beyond the approved issue and the current association rules.

1. Attribution. `experimentId` requires a `cohortId` belonging to that experiment, and `cohortId` requires `experimentId`. Status gates stay excluded.

2. Delivery lines now in the acceptance criteria. Synthetic v4 and v5 fixtures carry a company, a person, a submission bundle, and an outreach transmission, with the hash, failure-injection, and rejection cases from the issue test plan. Torn multi-file reads are required in `docs/cli.md`, `docs/data-layout.md`, and `docs/architecture.md`: lock-free reads, including `model upgrade-preview`, `action list`, and `action get`, can observe a torn multi-file read while a locked mutation writes files one at a time. A torn read is not a successful upgrade and is not a reason to create `actions.json`.

3. Replay response. The acceptance doc carries the reproduction. The stored success, including historical `schemaChanged` and historical `recovery`, stays intact. The finalized field is `currentRecovery` with the schema in "Replay of a stored upgrade". The committed-upgrade order stays preflight, recover, reload ledger, replay or conflict check, then source-token comparison. Replay does not perform the historical schema write.

4. Six plan conflicts returned by a later independent Codex review. The acceptance doc and this ADR now say: ordinary commands classify the live vault before recovery and before replay; graph node 5 owns collection registration, the ordinary guard, factories, and `scripts/c0-baseline.mjs`, and graph node 6 owns the upgrade commands; `validateModel` calls `validateActions` from `src/actions.mjs`; the company-with-no-vacancy case is a synthetic company with no opportunity and no application attempt, plus a successful person-only plan; discovery is `test/planned-actions-discovery.test.mjs` against shipped schemas, and `docs/stack-conventions.md` changes only the architect `RECORD_TYPES` sentence; failure injection separates handled rollback before the committed marker, an abrupt pre-commit interruption, an abrupt post-commit interruption, and a handled journal-deletion exception after the marker. The post-marker exception preserves the published bytes and ledger row, leaves the journal `committed`, and returns `JOURNAL_CLEANUP_FAILED`. Those corrections were written while the documents were proposed. A later independent review found that a handled exception after the committed marker could still restore preimages. The post-marker sentences above are the correction for that finding. They do not claim that the independent review passed.

### Non-goals

- Issues #24 and #25.
- Skill-source edits. Shared skill files wait for Issue 3.
- Private-instance migration and campaigns.
- Envelope changes and existing-command output-schema work owned by issue #17, except the optional `direction` input on eligible `interaction record` kinds.
- A public init command, a downgrade command, a clock command, or a repair that rewrites historical rows or historical vault versions.
- Action backlinks on parent career files, index pages, or `entity upsert`.
- Filters or a new output schema on `action list` and `action get` beyond the stored record and the existing read envelope.
- Treating strategy or experiment attribution as execution, or moving contact clocks from attribution, internal completion, or undirected `conversation` and `interview` rows.
- Creating an interaction or changing `lifecycle_status` or `pursuit_status` from action completion.
- Accepting this ADR by human graph acceptance, delivery acceptance, reviewer sign-off, or PR readiness.

## Consequences

Ordinary commands stop treating a v4 vault as a live model. The operator previews, then applies that token, before list, get, doctor, or dry-run will load it. A missing `actions.json` on v5 is a malformed vault, so writers must not paper over it by creating the file.

Upgrade replay stays trustworthy after the vault has moved to v5 because the stored success returns before the live fingerprint is compared. `schemaChanged: true` on a replay describes the stored write. `replayed: true` means this call did not perform that schema write again. Historical `recovery` stays the stored object. Finalized `currentRecovery` tells the caller what this invocation restored, including when the stored `recovery.performed` is false and a later recover-only would see no journal.

Recover-only and a missing token stay different operations. A pending journal blocks preview until an explicit recover-only, or until apply is invoked with a token and passes preflight.

The old binary can still stamp version 4 and eight counts onto a v5 vault. Documentation carries that risk. This design does not add a downgrade or a history rewrite.

Index pages stay free of action links, so an upgrade whose `renderIndexes` bytes would not change has an empty projected index map. Action lookup is `action list` and `action get`.

Contact clocks are derived. Pipeline status output stays as it is. Direction exists only on the closed contact-kind set, and only on rows written from this change forward.

## Confirmation

Independent Codex review of the node-1 acceptance doc reported no blocker. This ADR folds in the replay clarification, the two-direction attribution rule, and the two delivery lines. A later review of this ADR found one blocker: replay preserved historical `recovery` and left the caller with no evidence when this invocation had recovered a different prepared journal. The correction keeps the stored success and adds current-invocation recovery beside it. The implementation-planner node finalized that field as `currentRecovery` and aligned the acceptance doc. A later independent Codex review of the plan found six conflicts with the accepted graph and with ordinary `mutate` ordering. A following review left one blocker: a handled exception after the committed marker could still restore preimages. This correction limits rollback to a journal that is still `prepared` and specifies `JOURNAL_CLEANUP_FAILED` when deletion fails after commitment. Design acceptance of this ADR and the acceptance doc is recorded by graph node 4 under the origin authority receipt after the final independent Codex PASS. This file is not that review, not a role pass, and not PR readiness. It does not claim to be an independent Codex re-review. Human delivery acceptance remains pending.
