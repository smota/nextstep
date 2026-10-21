# Planned career actions and the v4 to v5 upgrade

Status: **proposed**
Issue: [#23](https://github.com/smota/nextstep/issues/23) — feat: add planned career actions with an explicit v4 to v5 upgrade
Profile: `high-assurance`
Surfaces: data, service, docs
Authority: `propose` (product manager and analyst). This document does not accept itself.
Date: 2026-10-21

Human graph acceptance does not accept this document. Human delivery acceptance stays pending. Origin collects and verifies the product-manager and analyst passes. This file is an input to those passes. It is not a completed role pass, not a reviewer pass, and not PR readiness.

## Job to be done

When a person has a real next step that is still ahead of them, they can record that planned action against a company, a person, an opportunity, or an application attempt, look it up again, pause it, change its wording or date, and close it with explicit evidence. Completing the plan leaves the interaction log and the application lifecycle as they were. An existing eight-collection vault gains the action store only when the operator previews the upgrade and then applies that preview.

## Product framing

The people affected are the vault operator and the external agent that calls the local CLI. Nextstep remains the mutation authority. The agent supplies facts the operator has already decided; the CLI stores them.

Today the vault is eight collections and manifest `schema_version` 4. `src/model.mjs` loads those collections and ignores the manifest version. A missing collection file fails as `MODEL_INCOMPLETE`. `src/storage.mjs` rewrites the manifest as `schema_version` 4 on ordinary mutation. There is no action store, no action lifecycle, and no stored contact direction. A planned follow-up cannot be represented by an interaction, an application close, or a strategy or experiment terminal: those records mean something else has already happened. Generic `entity upsert` drops omitted fields, so action fields need their own commands.

Release intent for this issue is one change that ships the explicit upgrade, the action commands, the completion event-match, the contact-clock direction rules, catalog schemas, examples, and operator docs together. Ready-vault factories that synthesize a new vault write `schema_version` 5. Vaults that already exist stay on version 4 until `model upgrade-preview` and `model upgrade-apply`.

## Current behavior this contract changes

Observed in the product tree:

- `RECORD_TYPES` and `RECORD_FILES` cover companies, opportunities, application attempts, people, interactions, artifacts, strategies, and experiments. `loadModel` returns eight empty arrays when the records directory is absent. It does not read `schema_version`.
- A missing canonical file raises `MODEL_INCOMPLETE` with `details.missingCollection`. Invalid JSON raises `MODEL_INVALID`.
- Ordinary mutation stamps `schema_version: 4` and eight counts. The model name is `nextstep-opportunity-graph`.
- Vault `doctor` catches a model error and can return `status: "degraded"` with exit code 2. That path is a successful degraded report, not the error envelope.
- Mutation responses use `{ schemaVersion: 1, requestId, status, changedEntities, revision, warnings, unresolvedEvidence, nextActions }`. Reads that load the vault use `{ schemaVersion: 1, status: "ok", ... }`. Failures use `{ schemaVersion: 1, status: "error", error: { code, message, details } }`.
- The commit lock returns `COMMIT_BUSY`. Idempotency replay returns the stored result before the operation runs. A reused key with a different digest returns `IDEMPOTENCY_CONFLICT`. `--dry-run` returns `status: "dry_run"` and writes nothing.
- Uninitialized mutations return `VAULT_NOT_INITIALIZED`. The product tree as a data root returns `PRODUCT_TREE_NOT_DATA`.
- Confirmed interactions recorded through `interaction record` require `occurred_at`. `outreach record-sent` stores kind `outreach` and does not store direction. Strategy and experiment attribution on a confirmed interaction applies `STRATEGY_NOT_ACTIVE` and `EXPERIMENT_NOT_RUNNING`.
- Submission-bundle `schema_version` values 2, 3, and 4 are evidence versions on an interaction. They are independent of the vault manifest version.
- Ready manifests at version 4 are written by `test/fixtures/career-vault.mjs`, `test/cli.test.mjs`, `test/opportunity-structured-fields.test.mjs`, and `scripts/c0-baseline.mjs`. `test/cli.test.mjs` asserts the eight-file `RECORD_FILES` list.

## Decisions

1. Version is an integer. Only `4` and `5` are recognized. The check happens before the generic missing-file error.
2. A consistent v4 vault is manifest `schema_version` 4, eight readable collection arrays, and eight agreeing counts. `actions.json` is absent, or present only as the canonical empty array written by the product JSON helper (`[]` followed by a newline) with no `counts.actions`. Ordinary vault commands still reject that vault with `VAULT_UPGRADE_REQUIRED` and write nothing. They do not treat the missing file, or that empty file, as the live action collection.
3. A v4 tree with any other `actions.json`, with an `actions` count, with unreadable records, or with disagreeing eight-counts is malformed (`MODEL_INVALID`). Preview does not issue a token for it.
4. A v5 vault whose `actions.json` is missing or whose `counts.actions` disagrees with the actions array is malformed (`MODEL_INVALID`). A missing `actions.json` is not an empty collection and is not `MODEL_INCOMPLETE`.
5. After the version check, a missing file among the eight career collections is still `MODEL_INCOMPLETE`.
6. Uninitialized roots keep today's behavior. Upgrade does not create a vault.
7. Vault `schema_version` 5 is not a submission-bundle version. No downgrade command exists. A previous binary that still stamps version 4 and eight counts can do that to a v5 vault; the docs state that risk. This issue does not rewrite history to repair it.
8. `src/model-upgrade.mjs` owns preview, apply, and recover-only. `src/actions.mjs` owns the action commands and the direction classifier. Commands and the CLI only wire those modules.
9. Action list and action get use the existing read envelope plus the stored record. They add no filters and no related-entity projection.
10. Contact clocks are derived from stored interactions. `pipeline status` and every other existing command output keep their current schema. The only existing-command input this issue adds is optional `direction` on eligible `interaction record` kinds, plus the stored outbound direction written by `outreach record-sent`.
11. Action attribution uses existence and the current experiment-to-strategy and cohort-to-experiment association checks. It does not apply `STRATEGY_NOT_ACTIVE` or `EXPERIMENT_NOT_RUNNING`.
12. `interaction record` keeps its current rule that a confirmed interaction requires `occurred_at`. Completion can still match a stored confirmed interaction whose `occurred_at` is absent or unusable.

## Frozen commands

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
| `action list` | Lock-free read. Options: `--json`, `--data-root`. |
| `action get` | Lock-free read. Options: `--json`, `--data-root`, `--id`. |

An unsupported option is `USAGE`. `--recover-only` combined with `--input` or `--dry-run` is `USAGE` and writes nothing, including no recovery. Preview rejects `--input`, `--dry-run`, and `--recover-only` as `USAGE`.

There is no new public init command and no downgrade command.

### Upgrade preview

Success:

```json
{ "schemaVersion": 1, "status": "ok", "token": {} }
```

The token is a JSON object with separate fields, using SHA-256 digests the product already computes:

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

The write set has no delete list. It does not name the eight career files, snapshot bytes, or transmission bytes. Stale index deletion stays outside it.

Preview accepts only a consistent v4 vault or a consistent v5 vault. It rejects a malformed version, unreadable records, and any pending domain journal. It writes nothing in every case. It does not take the commit lock, so a held lock is not `COMMIT_BUSY` on preview. A pending journal is `PENDING_JOURNAL`.

### Upgrade apply

`--input` is the mutation envelope: `schemaVersion` `1`, `requestId`, `idempotencyKey`, optional `actor`, and `payload.token` equal to a preview token. A missing token, a missing envelope field, or `schemaVersion` other than `1` is `INVALID_COMMAND` or `INVALID_ENVELOPE` by the existing envelope rules, happens before the lock, and does not recover.

Under the lock the order is fixed:

1. Preflight every domain journal for path, state, and containment before any recovery and before trusting or reloading the ledger.
2. An unsafe, unknown, or unreadable journal aborts the whole set with `UNSAFE_JOURNAL`. No journal is restored and no schema bytes are written.
3. Only a clean preflight may recover. `prepared` restores contained preimages. `committed` drops the journal. A ledger row published while the journal is still `prepared` is not success; recovery restores that ledger preimage.
4. Reload the ledger. The same idempotency digest returns the stored success before source-token comparison. A reused key with a different digest is `IDEMPOTENCY_CONFLICT` and writes nothing. Current-invocation recovery on that replay is `currentRecovery`. It is not written into the stored result.
5. Recompute the fingerprint only when the digest is not a stored match. Drift is `STALE_REVISION`, writes no schema, and reports this invocation's recovery in `error.details.recovery`.
6. A matching v4 token writes only the preview write set. The eight career files, snapshots, submission bundles, and transmission bytes stay byte-identical. The eight collection counts keep their values. The new manifest is `schema_version` 5, model `nextstep-opportunity-graph`, with `counts.actions` `0` and an empty `actions.json` array. The audit commit keeps the previous prefix and appends one line. The ledger gains or replaces that command's idempotency record.
7. A matching v5 token has an empty domain write set and writes nothing, including no ledger append and no audit line.

Apply success uses the mutation response and adds only:

```json
{
  "recovery": { "performed": false, "journals": 0 },
  "schemaChanged": true
}
```

`schemaChanged` is true only when this call wrote the v4 write set. On a fresh apply, `recovery` is this invocation and is what the ledger stores. `recovery.performed` is true when this call restored or dropped journals, including when `schemaChanged` is false. A fresh apply does not add `currentRecovery`.

`currentRecovery` is the finalized name for recovery performed by a replay invocation. The shape has no other fields:

```json
{ "performed": true, "journals": 1 }
```

`performed` is a boolean and is true exactly when `journals` is greater than zero. `journals` is an integer greater than or equal to zero and counts journal files this invocation restored (`prepared`) or dropped (`committed`).

A replayed apply success returns the stored result, including historical `schemaChanged` and historical `recovery`, and adds `replayed: true` plus top-level `currentRecovery`. `currentRecovery` is not written into the ledger result and does not replace historical `recovery`. Recover-only reports this invocation only through top-level `recovery` and does not add `currentRecovery`. A rejection after recovery reports this invocation through `error.details.recovery` and does not add `currentRecovery`.

Reproduction. A surviving committed upgrade ledger row stores `schemaChanged: true` and `recovery.performed: false`. A different prepared journal is also present. Apply with the same digest preflights, recovers that other journal, reloads the ledger, and replays before source-token comparison. The response keeps the stored `schemaChanged: true` and stored `recovery.performed: false`, sets `replayed: true`, and sets `currentRecovery` to `{ "performed": true, "journals": <recovered count> }`. This call does not rewrite the ledger row and does not apply the historical upgrade write set again. A following `--recover-only` finds no remaining journal and reports `recovery.performed: false`.

`--dry-run` writes nothing and recovers nothing. It returns `status: "dry_run"` when the token matches the current vault. A prepared journal beside a dry-run is left in place.

Lock busy stays `COMMIT_BUSY`.

### Recover-only

`model upgrade-apply --recover-only` locks, preflights every journal, recovers supported journals, writes no schema, and appends no upgrade audit line and no upgrade ledger record. It is the way to clear a pending journal when preview refuses a token. It is not what a forgotten token does.

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

### Action records

Stored records are snake_case. CLI payloads are camelCase. Status, category, and kind tokens are lowercase enums on both sides.

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

Every action stores nonempty provenance: `actor`, `created_at`, `updated_at`, `source_revision`, and append-only `history`. `created_at` is set once from the command clock. `updated_at` changes on every successful mutation. Both are real UTC date-times. `source_revision` starts at `0`. Each history entry is `{ "command", "at", "source_revision" }` for the revision stored after that mutation. `command` is the route name, such as `action plan`.

`due_on` is a real `YYYY-MM-DD` date or absent. Impossible calendar dates are `INVALID_COMMAND`.

Optional `strategyIds`, `experimentId`, and `cohortId` are attribution only. When present they must exist. The experiment's `strategy_ids` contain each named strategy, and the cohort belongs to that experiment. `experimentId` requires a `cohortId` that is a member of that experiment. `cohortId` requires `experimentId`. Storing them does not count as execution, does not apply confirmed-event status gates, and does not move clocks.

Ids start with `action:`. A caller may supply `payload.id` with that prefix. Omitted ids are generated with that prefix. A duplicate id is `INVALID_COMMAND`. Parent career files and generated index pages do not gain action backlinks. `entity upsert` has no `action` type and cannot create or replace an action.

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

`plan` rejects a supplied `expectedRevision` with `INVALID_COMMAND`. Every later action mutation requires envelope `expectedRevision`. A mismatch is `STALE_REVISION` with `details.currentRevision` and writes nothing. Idempotency replay and `expectedRevision` stay separate: the same digest returns the stored success before the revision check. A new key sees the live revision.

`complete` and `cancel` are terminal. A later action command on `completed` or `cancelled` is `INVALID_TRANSITION` and writes nothing. `unwait` is the command that returns `waiting` to `open`.

`completedAt` is required on complete, is a real UTC date-time, and is stored from the payload. It is not copied from an interaction.

External completion is an event match. The cited interaction must already exist, have `evidence_state` `confirmed`, have `kind` equal to `expected_kind`, and cover every action subject on its own foreign keys: `company_id`, `person_ids`, `opportunity_id`, and `application_attempt_id`. Extra foreign keys may exist. Derived backlink arrays are not the match. A confirmed `conversation` or `interview` completes the action when its kind was the expected kind, including when `direction` is absent and when `occurred_at` is absent or unusable. Completion does not require direction. A missing interaction is `NOT_FOUND`. A present interaction that fails the match is `INVALID_COMMAND`.

Internal completion requires a nonempty `result`, an artifact id already linked to one of the subjects through that artifact's `owner_id` or `subject_ids`, or both. An interaction id on an internal complete is `INVALID_COMMAND` and does not move contact clocks. A missing artifact is `NOT_FOUND`. An artifact that exists and is not linked to a subject is `INVALID_COMMAND`.

Completion never inserts an interaction and never changes `lifecycle_status` or `pursuit_status`. One interaction may be cited by several actions. Completing one leaves the others open.

`note` on plan or update is a nonempty string, or `null` on update to clear it. Any other action field on update or reschedule is `INVALID_COMMAND`.

### Action list and action get

Both are lock-free, write nothing, do not create `actions.json`, and use the same v4 rejection as other ordinary vault reads.

`action list` returns the stored array in file order:

```json
{ "schemaVersion": 1, "status": "ok", "actions": [] }
```

`action get --id <action-id>` returns one stored record:

```json
{ "schemaVersion": 1, "status": "ok", "action": {} }
```

An unknown id is `NOT_FOUND`. A missing `--id` is `USAGE`. There is no status filter, subject filter, or other query option.

On a consistent v5 vault, an empty actions array is a successful list. On a v5 vault with `actions.json` missing, list and get fail `MODEL_INVALID` and leave the file absent. When the records directory is absent, list returns an empty `actions` array and get returns `NOT_FOUND`, and neither creates a file.

### Direction and contact clocks

Direction may be stored only on the closed contact-kind set: `outreach`, `outreach_sent`, `outreach_response`, `human_response`, `conversation`, `interview`, `screen`. The stored field is `direction` with value `outbound` or `inbound`.

`src/actions.mjs` exports the classifier used by `interaction record` and `outreach record-sent`. For a confirmed contact-kind interaction with a real `occurred_at`:

- explicit `outbound` or `inbound` selects that clock, and explicit direction wins over kind
- with no direction, kind `outreach` or `outreach_sent` selects outbound, as a kind match
- every other undirected contact kind stays unknown, including `conversation` and `interview`

Any other row stays unknown. That includes a non-contact kind, a contact kind without a real `occurred_at`, and an unconfirmed row. Non-contact kinds include `note`, `application_outcome`, `opportunity_decision`, and `strategy_gate_decision`, plus every other kind. Direction on those kinds is `INVALID_COMMAND`. They never enter either clock.

`outreach record-sent` stores kind `outreach` and direction `outbound`. Omitted direction and explicit `outbound` both store `outbound`. Any other caller direction is `INVALID_COMMAND` and writes nothing.

`interaction record` may set payload `direction` only with an eligible contact kind. The rest of that command's current confirmation rules stay in place.

`application-attempt record-submission` does not set direction and does not feed contact clocks. A supplied `direction` on that command is `INVALID_COMMAND` and writes nothing.

Historical rows are left as stored. This issue does not add direction to them.

No clock command is added. Tests observe clocks by classifying stored interaction records. `pipeline status` does not gain clock fields.

## Read versus mutation

Ordinary vault reads and writes include doctor, validate, get, pipeline status, context and readiness reads that load the model, dry-run mutations, `action list`, and `action get`. On a consistent v4 vault they reject with `VAULT_UPGRADE_REQUIRED`, write nothing, and do not report that case as a degraded success.

Vault `doctor` throws that error. The CLI prints the error envelope on stderr and exits 1. Exit 2 remains the exit for a real degraded report, including today's uninitialized doctor. `doctor --integration` stays an integration report; it does not load the career model and is not the upgrade gate.

The v4 rejection is not used for:

- `model upgrade-preview` on a consistent v4 or v5 vault
- `model upgrade-apply` with a matching token
- `model upgrade-apply --recover-only`
- commands that never load the career vault
- an uninitialized root
- the product tree used as a data root (`PRODUCT_TREE_NOT_DATA`)

Ordinary v5 reads require version 5 and a present actions array and write nothing. Ordinary v5 mutations keep version 5 and the actions count. They do not create `actions.json` as a side effect.

`artifact bootstrap-snapshots` stays a snapshot tool. On a v5 vault it must not force version 4 or invent `actions.json`.

## Error codes

Existing codes keep their current meaning. This issue adds two taxonomy entries.

| Code | When |
| --- | --- |
| `VAULT_UPGRADE_REQUIRED` | Consistent v4 vault on an ordinary read or write, including doctor, dry-run, `action list`, and `action get`. |
| `PENDING_JOURNAL` | Preview sees a readable pending domain journal. No token is issued. |
| `MODEL_INVALID` | Version other than integer 4 or 5; v4 with a non-empty `actions.json` or an actions count; v5 with missing `actions.json` or disagreeing `counts.actions`; unreadable JSON. |
| `MODEL_INCOMPLETE` | After the version check, a missing file among the eight career collections. |
| `UNSAFE_JOURNAL` | Unsafe, unknown, or unreadable journal. No preimage in the set is restored. No schema write. |
| `STALE_REVISION` | Upgrade token no longer matches after recovery, or an action `expectedRevision` does not match on a new idempotency key. |
| `IDEMPOTENCY_CONFLICT` | Reused key with a different digest. Writes nothing. |
| `COMMIT_BUSY` | Apply or recover-only while the commit lock is held. |
| `INVALID_ENVELOPE` | Mutation `schemaVersion` is not 1, or `requestId` / `idempotencyKey` is missing on a mutation that requires them. |
| `INVALID_COMMAND` | Payload breaks the command contract, including a missing upgrade token, bad category, empty objective, duplicate subjects, impossible dates, kind mismatch, uncovered subjects, internal completion that passes an interaction, direction on a non-contact kind, or contradictory `outreach record-sent` direction. |
| `INVALID_TRANSITION` | Action status change is not in the lifecycle table. |
| `NOT_FOUND` | `action get` id is absent, or a cited subject, interaction, artifact, strategy, or experiment does not exist. |
| `USAGE` | Unknown route or unsupported option, including combining `--recover-only` with `--input`. |
| `VAULT_NOT_INITIALIZED` | Mutation, preview, or apply on an uninitialized root. |
| `PRODUCT_TREE_NOT_DATA` | Product tree supplied as the data root. |

`VAULT_UPGRADE_REQUIRED` message is:

`Vault schema_version 4 requires an explicit upgrade. Run model upgrade-preview, then model upgrade-apply with that token.`

Its details are `{ "schemaVersion": 4, "previewCommand": "model upgrade-preview", "applyCommand": "model upgrade-apply" }`.

`PENDING_JOURNAL` details include `{ "recoverCommand": "model upgrade-apply --recover-only" }`.

`MODEL_INVALID` details include `reason`: `schema_version`, `unexpected_actions`, `actions_missing`, `actions_count`, or `unreadable`.

`UNSAFE_JOURNAL` details include `reason`: `unsafe`, `unknown`, or `unreadable`.

When apply or recover-only has already restored bytes and then rejects, `error.details.recovery` is `{ "performed": true, "journals": <number> }` and schema bytes are unchanged. That error field is this invocation. It is not `currentRecovery`. `currentRecovery` appears only on a replayed apply success.

Action attribution does not raise `STRATEGY_NOT_ACTIVE` or `EXPERIMENT_NOT_RUNNING`.

## Modules later nodes must keep

`src/model-upgrade.mjs` owns preview, apply, and recover-only, including the token, journal preflight, recovery, replay, and write set. It does not own action records, action validation, or the direction classifier.

`src/actions.mjs` owns `plan`, `wait`, `unwait`, `update`, `reschedule`, `complete`, `cancel`, `list`, and `get`, plus action validation, the completion event-match, and the contact-clock direction classifier used by `interaction record` and `outreach record-sent`.

`src/commands.mjs`, `src/cli.mjs`, and `src/command-catalog.mjs` wire those modules into routes, help, `COMMAND_CONTRACTS`, and `ERROR_TAXONOMY`. They do not grow a second implementation of the upgrade write set or the completion match.

`src/model.mjs` remains the collection registry, load gate, and model validator. `src/storage.mjs` remains the lock, journal, manifest, and index writer used by the upgrade module. Neither file becomes the owner of action lifecycle rules.

The upgrade node is the only node that creates `src/model-upgrade.mjs`. The action node is the only node that creates `src/actions.mjs`. Shared files `src/model.mjs`, `src/storage.mjs`, `src/commands.mjs`, `src/cli.mjs`, `src/command-catalog.mjs`, and the ready-vault factories stay serialized.

## Acceptance criteria

These are pass/fail checks for the later implementation and docs nodes.

1. On a consistent v4 vault, ordinary vault commands, including `doctor`, `--dry-run`, `action list`, and `action get`, exit through the error envelope with `VAULT_UPGRADE_REQUIRED`, the preview-then-apply message, and details above. Career files, snapshots, audit, and the ledger keep their hashes. `actions.json` is not created. Doctor does not return `status: "degraded"` for this case and does not exit 2.
2. A v4 vault with the eight files present and `actions.json` absent does not report `MODEL_INCOMPLETE` for actions. A v5 vault with `actions.json` absent or with `counts.actions` disagreeing reports `MODEL_INVALID` and is not returned as an empty action list. A missing file among the eight career collections, after a recognized version, remains `MODEL_INCOMPLETE`.
3. Any manifest version other than integer 4 or 5 is `MODEL_INVALID`. Uninitialized roots still return today's uninitialized doctor and `VAULT_NOT_INITIALIZED` on mutation. Preview and apply on an uninitialized root create no vault.
4. `model upgrade-preview` writes nothing and does not take the lock. Its token names the audit prefix, the ledger preimage, the current index bytes, and the projected index bytes, and its write set excludes career collection files, snapshot bytes, transmission bytes, and index deletion. A pending journal returns `PENDING_JOURNAL` and no token. A journal set whose later path escapes the vault restores no earlier preimage.
5. Apply without a token returns an error and does not recover. Apply of the v4 token moves the manifest to version 5 with `counts.actions` 0, creates the canonical empty `actions.json` when it was absent, and leaves those bytes unchanged when they were already that empty array. It preserves historical career bytes, snapshots, submission bundles, transmission bytes, and the eight counts, keeps the audit prefix, and appends one audit line. A second apply of a token previewed from that v5 vault writes nothing, including no ledger append.
6. Replay of a committed upgrade returns the stored result after recovery and before source-token comparison, including when the live fingerprint has changed. The stored `schemaChanged` and stored `recovery` remain the historical values, with `replayed: true`. Replay does not perform the historical schema write. The same response reports this invocation's recovery in top-level `currentRecovery` and does not write that field into the ledger result. A conflicting key is `IDEMPOTENCY_CONFLICT` and writes nothing. A crash after the ledger write and before the committed marker rolls the ledger back on recovery and does not report success. `--recover-only` recovers a supported journal, writes no schema, and appends no upgrade audit line. Drift or another rejection after recovery changes no schema and reports this invocation's recovery in `error.details.recovery`, separate from schema change.
7. Reproduction for `currentRecovery`. A surviving committed upgrade ledger row stores `schemaChanged: true` and `recovery.performed: false`. A different prepared journal is also present. Apply with the same digest preflights, recovers that other journal, reloads the ledger, and replays before source-token comparison. The response keeps the stored `schemaChanged: true` and stored `recovery.performed: false`, sets `replayed: true`, and sets `currentRecovery` to `{ "performed": true, "journals": <recovered count> }`. This call does not rewrite the ledger row's stored result and does not apply the historical upgrade write set again. A following `--recover-only` finds the journal already removed and reports that no journal remained.
8. `--dry-run` on apply and on action commands writes nothing. Dry-run beside a prepared journal leaves that journal in place. Lock busy remains `COMMIT_BUSY`.
9. Default ready-vault factories emit `schema_version` 5, nine collection files including empty `actions.json`, and nine counts. The observed writers are `src/model.mjs`, `src/storage.mjs`, `test/fixtures/career-vault.mjs`, `test/cli.test.mjs`, `test/opportunity-structured-fields.test.mjs`, and `scripts/c0-baseline.mjs`, plus every other helper or test that writes a ready manifest or asserts the eight-file set. A dedicated v4 fixture drives upgrade tests and is not the default factory. No new init command exists. `artifact bootstrap-snapshots` on v5 does not force version 4 or invent `actions.json`.
10. Company with no vacancy: `action plan` an `external_contact` with `expectedKind` `outreach`, record confirmed outbound through `outreach record-sent`, `action complete` against that interaction, and `action plan` a continuation. A confirmed `conversation` with no direction completes an action whose expected kind is `conversation` and moves neither clock, including when `occurred_at` is absent or unusable on a stored confirmed row. Internal completion does not move the outbound clock, does not add an interaction, and does not change application lifecycle. Completion evidence is the event match, the internal result, or the linked artifact. Direction and a clock-usable `occurred_at` are not completion evidence.
11. `entity upsert` cannot write an action. Terminal states stay terminal. `unwait` returns `waiting` to `open` and keeps due date, note, category, and history. A person subject does not attach a company. Contradictory direction on `outreach record-sent` is rejected. Direction on a note, outcome, or other non-contact kind is rejected. `application-attempt record-submission` does not store direction. `experimentId` without a cohort that belongs to that experiment is `INVALID_COMMAND`. `cohortId` without `experimentId` is `INVALID_COMMAND`. Neither pair applies `STRATEGY_NOT_ACTIVE` or `EXPERIMENT_NOT_RUNNING`.
12. `action list` returns the stored actions. `action get` returns one stored action or `NOT_FOUND`. Neither accepts a filter, neither creates `actions.json`, and both are lock-free. Both are routes, catalog entries, help lines, operator docs, and read-only tests.
13. Discovery matches the shipped schemas for every frozen command, including `action list` and `action get`, the camelCase payload map, optional `direction` on eligible `interaction record` kinds, `VAULT_UPGRADE_REQUIRED`, `PENDING_JOURNAL`, the `currentRecovery` replay field, no downgrade command, and the old-binary risk. Operator docs state that vault version 5 is not a submission-bundle version and that a previous binary can force version 4 and eight counts. `docs/cli.md`, `docs/data-layout.md`, and `docs/architecture.md` state that lock-free reads, including `model upgrade-preview`, `action list`, and `action get`, can observe a torn multi-file read while a locked mutation writes files one at a time. A torn read is not a successful upgrade and is not a reason to create `actions.json`.
14. Tests use synthetic v4 and v5 fixtures with a company, a person, a submission bundle, and an outreach transmission. They hash career files, snapshots, the audit prefix, the ledger, indexes, and counts around preview, rejected apply, recovery, and ordinary v4 reads. They inject failure before and after the new-file rename, after ledger publication but before the committed marker, and around the committed marker. The pre-commit crash rolls the ledger back and does not report success. They cover retry, replay only after recovery and before source-token comparison, conflicting reuse, stale preview, stale revision, lock busy, and dry-run beside a prepared journal. They reject bad subjects, uncovered links, kind mismatch, impossible dates, internal completion that passes an interaction, and direction on non-contact kinds. They assert the product tree is not a data root, that read-only commands create no files, and that factories used by ordinary tests write version 5.

## Non-goals

- Issues #24 and #25.
- Skill-source edits. Shared skill files wait for Issue 3.
- Private-instance migration and campaigns.
- Envelope changes and existing-command output-schema work owned by issue #17, except the optional `direction` input on eligible `interaction record` kinds.
- A public init command, a downgrade command, a clock command, or a repair that rewrites historical rows or historical vault versions.
- Action backlinks on parent career files, index pages, or `entity upsert`.
- Filters or a new output schema on `action list` and `action get` beyond the stored record and the existing read envelope.
- Treating strategy or experiment attribution as execution, or moving contact clocks from attribution, internal completion, or undirected `conversation` and `interview` rows.
- Creating an interaction or changing `lifecycle_status` or `pursuit_status` from action completion.
- Accepting this document by human graph acceptance, delivery acceptance, reviewer sign-off, or PR readiness.

## Assumptions

- The command clock is the UTC timestamp the command layer already uses for audit `at` values.
- New mutations use the existing envelope `schemaVersion` 1.
- "Linked artifact" means `owner_id` or `subject_ids` already contains one of the action subject ids.
- The in-memory uninitialized short-circuit may include an empty actions array and still must not write a vault. Callers of an uninitialized root see today's doctor and `VAULT_NOT_INITIALIZED` results.
- Ready-vault factory coverage includes the writers observed above. Implementation adds any further writer of a ready manifest that the same search finds.

## Open questions

None blocking. `currentRecovery` is the finalized replay field name and schema. Independent review can return this document while it is still proposed.

## Handoff

The architect receives this proposed document and the approved issue. The ADR is `docs/adr/014-planned-career-actions-v5.md`, status proposed. The implementation plan is `docs/plans/issue-23-implementation.md`, status proposed. Accepted status waits for a later recorded design authority after independent Codex review. Human graph acceptance does not accept this document or the ADR. Human delivery acceptance remains pending.

Origin owns collection of the product-manager and analyst passes. A local note under `.agent-runs/issues/23/` records what this node read and decided. That note does not mean either role has passed.
