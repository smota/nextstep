# Implementation plan — planned career actions and vault schema v5

Status: **proposed**

Issue: [#23](https://github.com/smota/nextstep/issues/23) — feat: add planned career actions with an explicit v4 to v5 upgrade

Date: 2026-10-21

Profile: `high-assurance`

Surfaces: data, service, docs

Authority: `propose` (implementation planner). This document does not accept itself. It is not an independent Codex review, not reviewer sign-off, not PR readiness, and not closure.

Contract: [issue-23-planned-career-actions.md](issue-23-planned-career-actions.md) and [ADR 014](../adr/014-planned-career-actions-v5.md), both status proposed. Those files are the behavior contract. This plan names the later nodes, files, and tests. It does not implement product code.

Human graph acceptance of the task graph is preserved. It does not accept this plan, the acceptance doc, or the ADR. Human delivery acceptance remains the integration gate and is pending. Design acceptance is recorded only by graph node 4 when a dispatch contains the origin's recorded design-acceptance authority after independent Codex review. This correction does not invent that authority. Nodes 5 through 9 stay undispatched until that acceptance is recorded.

## Gates this plan keeps

- User gate: the approved issue #23 text, including its test plan.
- Graph gate: `.meshloop/plans/issue-23.json` nodes 4 through 9, in that order, with the allowed paths quoted below. This plan does not change the graph.
- Node gate: this correction writes proposed docs only. It does not edit `src/`, `test/`, `scripts/`, `skills/`, or operator docs.
- Design gate: the acceptance doc, ADR, this plan, and the Grok review stay proposed.
- Delivery gate: human delivery acceptance stays pending. No publish, commit, push, or worker spawn belongs to this correction.

`npm test` is the suite each implementation stage must leave green. The accepted graph says that command executes `node --test test/*.test.mjs`. Nodes 5, 6, 7, and 8 each run it and record the command and exit code in `.agent-runs/issues/23/` before that node is finished. A non-zero exit means the node is not finished. Node 9 runs it again and records only that note. This correction does not run the suite.

## Graph nodes 4 through 9

Nodes run in id order. They are not parallel. A later node starts only after the previous node's work is integrated. Implementation nodes also wait for that node's `npm test` evidence.

| Node | Role | Creates | Allowed paths |
| --- | --- | --- | --- |
| 4 | Record design acceptance only when the dispatch contains that authority | none | `docs/plans/issue-23-planned-career-actions.md`, `docs/adr/014-planned-career-actions-v5.md`, `docs/plans/issue-23-implementation.md`, `docs/plans/issue-23-pre-implementation-review.md`, `.agent-runs/issues/23/` |
| 5 | v5 foundation | `test/vault-v5-foundation.test.mjs`, `test/fixtures/vault-v4.mjs` | `src/model.mjs`, `src/storage.mjs`, `src/commands.mjs`, `test/`, `scripts/c0-baseline.mjs`, `.agent-runs/issues/23/` |
| 6 | Explicit upgrade | `src/model-upgrade.mjs`, `test/model-upgrade.test.mjs` | `src/model-upgrade.mjs`, `src/model.mjs`, `src/storage.mjs`, `src/commands.mjs`, `src/cli.mjs`, `src/command-catalog.mjs`, `test/`, `.agent-runs/issues/23/` |
| 7 | Actions, list, get, completion, direction | `src/actions.mjs`, `test/actions.test.mjs` | `src/actions.mjs`, `src/model.mjs`, `src/commands.mjs`, `src/cli.mjs`, `src/command-catalog.mjs`, `test/`, `.agent-runs/issues/23/` |
| 8 | Operator docs and discovery | `test/planned-actions-discovery.test.mjs` | `docs/cli.md`, `docs/data-layout.md`, `docs/architecture.md`, `docs/stack-conventions.md`, `test/planned-actions-discovery.test.mjs`, `.agent-runs/issues/23/` |
| 9 | Tester | the local note only | `.agent-runs/issues/23/` |

`src/model-upgrade.mjs` is created only by node 6. `src/actions.mjs` is created only by node 7. Node 5 must not create either file, must not add upgrade or action routes, and must not edit `src/cli.mjs` or `src/command-catalog.mjs`. Node 6 must not create or edit `src/actions.mjs` and must not edit `scripts/c0-baseline.mjs`. Node 7 must not edit `src/model-upgrade.mjs` or `src/storage.mjs`. Node 8 must not edit `src/`. Node 9 must not edit tracked product files.

Shared files stay serialized:

- `src/model.mjs`: node 5, then node 6 only for the upgrade reader integration, then node 7 only for the `validateActions` call.
- `src/storage.mjs`: node 5, then node 6. Node 7 does not edit it.
- `src/commands.mjs`: node 5 for `doctor` only, then node 6 for upgrade wiring, then node 7 for action wiring.
- `src/cli.mjs` and `src/command-catalog.mjs`: node 6, then node 7.
- Ready-vault factories and `scripts/c0-baseline.mjs`: node 5 only. Node 6 and node 7 do not edit `test/fixtures/career-vault.mjs`, `test/fixtures/vault-v4.mjs`, `test/cli.test.mjs`, `test/opportunity-structured-fields.test.mjs`, or `scripts/c0-baseline.mjs`.

There is no new public init command. No node adds `init`, `model init`, or a downgrade route.

## Node 5 — v5 foundation

Owns collection registration, the ordinary version guard, the v5 manifest stamp, doctor rejection, and the split between v5 default factories and the legacy v4 fixture. It does not implement preview, apply, recover-only, action commands, or direction.

### Collection and manifest

In `src/model.mjs`:

- Append `actions` to `RECORD_TYPES` after `experiments`.
- Add `RECORD_FILES.actions = 'actions.json'` and id prefix `action`.
- The missing-records short-circuit includes `actions: []` and still writes nothing.
- `counts()` follows `RECORD_TYPES`, so a loaded v5 model has nine counts.
- `loadModel` reads `manifest.json` before the missing-file check. Integer `4` and `5` are the only recognized versions. Any other version, a missing manifest on an existing records directory, or unreadable manifest JSON is `MODEL_INVALID` with `details.reason` `schema_version` or `unreadable`.
- A consistent v4 vault is version 4, eight readable career arrays, and eight agreeing counts. `actions.json` is absent, or present only as the canonical empty array from `json([])` (`[]` plus a newline) with no `counts.actions`. Ordinary `loadModel` throws `VAULT_UPGRADE_REQUIRED` with the preview-then-apply message and details `{ schemaVersion: 4, previewCommand: 'model upgrade-preview', applyCommand: 'model upgrade-apply' }`. It does not create `actions.json`.
- Any other v4 `actions.json`, a v4 `counts.actions`, unreadable career JSON, or disagreeing eight-counts is `MODEL_INVALID`.
- v5 with `actions.json` missing is `MODEL_INVALID` reason `actions_missing`, not `MODEL_INCOMPLETE` and not an empty list. Disagreeing `counts.actions` is reason `actions_count`.
- After a recognized version, a missing file among the eight career collections remains `MODEL_INCOMPLETE`.
- Export one classifier so node 6 does not keep a second copy of the version rules. Ordinary `loadModel` still throws `VAULT_UPGRADE_REQUIRED` for consistent v4.
- `rebuildBacklinks` does not add action ids to parent records. `renderIndexes` does not gain an actions page. `validateModel`'s generic id loop accepts `action:` ids and an empty actions array. Node 5 does not import `src/actions.mjs` and does not encode lifecycle transitions.

### Ordinary version guard

`mutate` in `src/storage.mjs` today calls `recoverTransactions` and returns a matching ledger result before `loadModel`. `dryRunMutation` returns a matching ledger result before `loadModel`. Node 5 changes that order for ordinary commands.

After the uninitialized check and the envelope check, and before recovery or ledger lookup:

1. Classify the live vault with the exported classifier. Do not recover first. Do not read the ledger first.
2. Consistent v4 throws `VAULT_UPGRADE_REQUIRED`. Dry-run does this before the ledger read and does not take the lock. A locked mutate does this after `acquireCommit` and before `recoverTransactions`, then releases the lock in the existing `finally`. Neither path restores preimages, deletes a journal, or returns a stored success.
3. Malformed version or a v5 disagreement throws `MODEL_INVALID` with the same no-write rule.
4. Consistent v5 continues into the existing `recoverTransactions` and then the existing ledger replay. Node 5 does not replace `recoverTransactions` with inspect-all recovery. That function still restores as it walks. Upgrade does not call it.

`outputs()` stamps `schema_version` 5 and nine counts from `counts(model)`. It must not stamp version 4. It writes `actions.json` only when that array is already in the loaded model and the bytes differ. It does not invent `actions.json` for a model that never loaded it.

In `doctor`, rethrow `VAULT_UPGRADE_REQUIRED` instead of folding it into `checks.model`. Exit 2 stays the degraded path, including uninitialized doctor. `doctor --integration` does not load the career model.

### Factories

v5 default writers, all in node 5:

- `src/model.mjs` empty in-memory model
- `src/storage.mjs` manifest writer
- `test/fixtures/career-vault.mjs`
- the local fixture in `test/cli.test.mjs`
- `tempVault` in `test/opportunity-structured-fields.test.mjs`
- `makeFixture`, `requiredRecords`, and `recordFiles` in `scripts/c0-baseline.mjs`

Each ready vault writes `schema_version` 5, nine collection files including canonical empty `actions.json`, and nine counts. `test/cli.test.mjs` today asserts the eight-file `RECORD_FILES` list. Node 5 updates that assertion to the nine-file list ending in `actions.json`.

`test/fixtures/vault-v4.mjs` is the dedicated legacy fixture. Ordinary command tests do not use it. It writes a consistent v4 vault: eight career files, no `actions.json`, eight counts, no `counts.actions`, plus a company, a person, a submission-bundle interaction, and an outreach transmission file whose bytes later upgrade tests hash. It also exports a consistent v5 twin, same career and snapshot bytes, empty `actions.json`, nine counts. Node 6 imports this fixture and does not edit it.

Before editing, node 5 re-reads the tree for other `schema_version: 4` ready-vault writers and eight-file assertions. Any writer of a ready manifest joins the v5 default set. The v4 fixture stays the only ready v4 writer.

`artifact bootstrap-snapshots` is unchanged as a command. On v5 it must not force version 4 or create a missing `actions.json`. The version stamp change in `outputs()` is what keeps it on version 5.

### Node 5 tests

File: `test/vault-v5-foundation.test.mjs`.

- Ordinary reads and writes on consistent v4, including `doctor` and a dry-run mutation, return `VAULT_UPGRADE_REQUIRED` and the details object. Doctor's thrown error is the CLI error envelope and exit 1, not `status: "degraded"` and not exit 2. Hashes of the eight career files, snapshots, transmission bytes, audit, and ledger are unchanged. `actions.json` is not created.
- A v4 vault whose ledger already contains the same idempotency digest still returns `VAULT_UPGRADE_REQUIRED`. The response is not the stored success and does not include `replayed: true`. Ledger bytes stay unchanged. The same assertion covers dry-run.
- A v4 vault with a prepared journal returns `VAULT_UPGRADE_REQUIRED`. The journal file remains. Preimages are not restored. Career bytes stay unchanged. Dry-run leaves that journal in place.
- v4 with the eight files and no `actions.json` is not `MODEL_INCOMPLETE` for actions. v5 missing `actions.json` is `MODEL_INVALID` reason `actions_missing`. A missing career file after a recognized version stays `MODEL_INCOMPLETE`. A non-integer or other version is `MODEL_INVALID`.
- Uninitialized doctor and `VAULT_NOT_INITIALIZED` stay as they are. The product tree as a data root stays `PRODUCT_TREE_NOT_DATA`. Read-only commands create no files.
- Default factories used by ordinary tests write version 5. `routeNames()` has no init command and no `model upgrade-preview` route yet.
- `artifact bootstrap-snapshots` on the v5 twin does not write version 4 and does not create `actions.json` when the test removes it: load fails `MODEL_INVALID` first.

Node 5 ends with `npm test` green and that result recorded in `.agent-runs/issues/23/`. Upgrade commands are not in the route table yet.

## Node 6 — explicit upgrade

Starts only after node 5 is green. Creates `src/model-upgrade.mjs`. Does not create `src/actions.mjs`. Does not edit `scripts/c0-baseline.mjs` or the node 5 factories.

`src/model-upgrade.mjs` exports preview, apply, and recover-only. It uses the node 5 classifier. It does not validate action records or classify contact clocks.

In `src/storage.mjs`:

- Export the existing stable envelope digest, today the private `digest` used by `mutate`, so upgrade replay uses one canonicalization.
- Export a lock wrapper that acquires and releases the existing commit lock and does not recover or load the ledger by itself.
- Add `inspectDomainJournals(paths)` and `restoreDomainJournals(paths, journals)`. Inspect reads every domain journal, checks state and containment of every preimage, and writes nothing. Unsafe, unknown, or unreadable journals throw `UNSAFE_JOURNAL` with `details.reason` `unsafe`, `unknown`, or `unreadable` and restore nothing. Restore runs only on a set inspect already accepted. `prepared` restores contained preimages. `committed` drops the journal. A ledger row written while the journal is still `prepared` is restored from that preimage.
- Leave the node 5 version guard in front of `recoverTransactions`. Do not move ledger replay back ahead of that guard.
- Split `applyTransaction` in this file. Node 6 does not add a second transaction writer. The restore catch may run only while the journal file is still `prepared`. The `committed` marker is written inside that try, as its last step. Journal deletion runs only after that try returns. A deletion exception does not restore preimages and does not rewrite the published files. If the journal file is still present, it stays `committed`. If deletion has already removed the file, that cleanup finished and the helper returns normally. `src/model-upgrade.mjs` calls this helper, propagates `JOURNAL_CLEANUP_FAILED`, and does not restore.

### Upgrade command behavior

Preview is lock-free and writes nothing. A held lock is not `COMMIT_BUSY` on preview. A pending domain journal, including a readable journal whose preimage is unsafe, is `PENDING_JOURNAL` with `details.recoverCommand` set to `model upgrade-apply --recover-only`, and no token. Preview does not recover and does not use `UNSAFE_JOURNAL`.

The token fields and both write sets are the ones in the acceptance doc. Digests use `sha` / `shaFile` from `src/model.mjs`. An absent audit file uses `sha('')`. An absent ledger uses `{ present: false, sha256: null }`. `projectedIndexSha256` maps only index paths whose `renderIndexes` bytes would change. The write set has no delete list and does not name the eight career files, snapshot bytes, or transmission bytes.

Apply envelope: `schemaVersion` 1, `requestId`, `idempotencyKey`, optional `actor`, `payload.token`. A missing token is `INVALID_COMMAND` before the lock and does not recover. Envelope failures stay `INVALID_ENVELOPE` before the lock.

Under the lock the upgrade order is fixed and is separate from the ordinary guard:

1. Inspect every journal before recovery and before reading the ledger.
2. Unsafe, unknown, or unreadable: `UNSAFE_JOURNAL`, no restore, no schema write.
3. Restore only after a clean inspect.
4. Reload the ledger.
5. Same idempotency digest: return the stored success with `replayed: true` and top-level `currentRecovery`. Do not compare the source token on this path. Do not rewrite the ledger result. Do not apply the historical write set again.
6. Different digest for the same key: `IDEMPOTENCY_CONFLICT`, no schema write.
7. Otherwise recompute the fingerprint. Drift is `STALE_REVISION` with `error.details.recovery` for this invocation and no schema write.
8. Matching v4 token: write only the preview write set inside one journal. Audit `command` is `model.upgradeApply`. The route remains `model upgrade-apply`. The appended audit line uses the existing audit object shape. The previous audit prefix stays byte-identical.
9. Matching v5 token: write nothing, including no ledger append and no audit line.

`currentRecovery` schema, finalized:

```json
{ "performed": true, "journals": 1 }
```

`performed` is true exactly when `journals` is greater than zero. `journals` counts journals this invocation restored or dropped. The field is present only on a replayed apply success. A fresh apply stores top-level `recovery` and `schemaChanged` and does not add `currentRecovery`. Recover-only uses top-level `recovery` and `schemaChanged: false` and does not add `currentRecovery`. A rejection after recovery uses `error.details.recovery` and does not add `currentRecovery`.

Fresh v4 success stores `schemaChanged: true` only when that execution wrote the v4 write set. A fresh matching v5 call stores no ledger row and returns `schemaChanged: false`.

`--dry-run` on apply does not take the lock, does not recover, and writes nothing. A prepared journal stays in place. The dry-run result is `status: "dry_run"` when the token matches the current bytes.

`--recover-only` uses the same inspect-then-restore order, writes no schema, and appends no upgrade audit or ledger row. Combined with `--input` or `--dry-run` it is `USAGE` before the lock and does not recover. A missing token is not recover-only.

Lock busy stays `COMMIT_BUSY` for apply and recover-only.

### Commitment boundary

`applyTransaction` today writes a `prepared` journal, writes the files, writes `committed`, and deletes the journal inside one try. Any throw, including a throw from that deletion, restores preimages and deletes the journal. Node 6 removes that unconditional restore. Rollback is allowed only before the committed marker.

The helper shape in `src/storage.mjs`:

1. Write the `prepared` journal.
2. In one try, write the value set and then write the journal state `committed`. The catch restores preimages and deletes the journal only when that file is still `prepared`, then rethrows the original error. The caller sees that error and not success.
3. After that try returns, delete the journal in a separate step. A finished deletion leaves no journal, and the caller returns the normal apply success. A throw from deletion does not restore preimages, does not rewrite schema bytes or the ledger, and leaves the journal file `committed` when the delete did not remove it. The caller returns `status: "error"` with `JOURNAL_CLEANUP_FAILED`. Details are `{ "committed": true, "publication": "preserved", "journalState": "committed" }`. When this invocation already recovered journals before that write, the same error also includes `error.details.recovery` for that earlier recovery and does not add `currentRecovery`. The message says the publication is committed and was not rolled back. This call does not return `status: "applied"`.

`src/model-upgrade.mjs` does not catch that cleanup error and restore. The ledger already holds the success row written before the marker. A later `model upgrade-apply` with the same digest, or `--recover-only`, drops the committed journal and does not restore preimages. The same-digest apply then replays the stored success. Schema stays v5.

Abrupt crash injection does not throw into either catch. The helper accepts `onPhase`. For a crash phase, it persists the journal in the requested state and returns control to the test without restoring and without deleting the journal. The next command in the same test is the restart. `onPhase('journal-delete')` is the handled cleanup injection: the committed marker is already durable, and the phase throws before deletion finishes, so only the cleanup step handles it.

| Phase | Disk after the interruption | This call | Restart |
| --- | --- | --- | --- |
| `before-actions-rename` | Journal `prepared`. `actions.json` absent. Ledger unchanged. | No success result. | Preimages stay the pre-upgrade bytes. No success result. |
| `after-actions-rename` | Journal `prepared`. New `actions.json` may exist. Ledger not yet the success row. | No success result. | Restore deletes a file that did not exist and rewrites bytes that did. No success result. |
| `after-ledger-publication` and `before-committed-marker` | Journal still `prepared`. Ledger file contains the new row. | No success result. | Restore the ledger preimage. Do not replay that row as success. Schema stays v4. |
| `after-committed-marker` | Journal state is `committed`. Ledger row and schema bytes are the published set. The process stopped before or during journal deletion. | No result. The process stopped. | Drop the journal. Do not restore preimages. The same digest replays the stored success. Schema stays v5. |
| `journal-delete` | Journal state is `committed`. Published schema bytes and the ledger success row stay. | `JOURNAL_CLEANUP_FAILED` with the details above. Not `applied`. No preimage restore. | Drop the committed journal. Do not restore preimages. Published bytes stay. The same digest replays the stored success. Schema stays v5. |

A thrown exception before the committed marker remains handled rollback: the restore catch runs, the journal is deleted, and the caller sees the original error rather than success. A thrown exception after the marker is not that rollback.

### Wiring in node 6

`src/commands.mjs`: export upgrade preview, apply, and recover-only by calling `src/model-upgrade.mjs`. Do not fold `VAULT_UPGRADE_REQUIRED` back into doctor.

`src/cli.mjs`: routes and help.

- `model upgrade-preview`: `--json`, `--data-root`. Reject `--input`, `--dry-run`, and `--recover-only` as `USAGE`.
- `model upgrade-apply`: `--json`, `--data-root`, `--input`, `--dry-run`, `--recover-only`. The command rejects `--recover-only` combined with `--input` or `--dry-run` as `USAGE` before the lock.

`src/command-catalog.mjs`: `COMMAND_CONTRACTS` entries for both routes, invariants for the token, the empty v5 write set, `currentRecovery` on replay only, and no downgrade. Add `VAULT_UPGRADE_REQUIRED`, `PENDING_JOURNAL`, and `JOURNAL_CLEANUP_FAILED` to `ERROR_TAXONOMY`. Keep `routeNames()` and `commandNames()` in parity.

`ENTITY_TYPES` gains no `action` type in this node.

### Node 6 tests

File: `test/model-upgrade.test.mjs`. Fixture: `test/fixtures/vault-v4.mjs`, unread by this node except as an import.

- Preview writes nothing and does not lock. The token names `auditPrefixSha256`, `ledgerPreimage`, `currentIndexSha256`, and `projectedIndexSha256`. The write set excludes career files, snapshots, transmission bytes, and index deletion. A pending journal returns `PENDING_JOURNAL` and no token.
- A journal set whose later preimage escapes the vault restores no earlier preimage and writes no schema.
- Apply without a token does not recover. Apply of the v4 token creates canonical empty `actions.json` when absent, leaves that empty file unchanged when already present, sets version 5 and `counts.actions` 0, preserves the eight count values and the historical career, snapshot, submission-bundle, and transmission bytes, keeps the audit prefix, and appends one audit line. A second apply of a token previewed from that v5 vault writes nothing, including no ledger append.
- Replay of the committed upgrade returns the stored result before source-token comparison after the live fingerprint has changed. Stored `schemaChanged` and stored `recovery` stay as stored.
- Reproduction: stored row has `schemaChanged: true` and `recovery.performed: false`. A different prepared journal is present. Same digest preflights, recovers that journal, reloads the ledger, and replays. Response keeps stored `schemaChanged: true` and stored `recovery.performed: false`, sets `replayed: true`, and sets `currentRecovery` to `{ performed: true, journals: <count> }`. The ledger result bytes do not gain `currentRecovery`. A following `--recover-only` reports no remaining journal.
- Conflicting reuse is `IDEMPOTENCY_CONFLICT` and writes nothing.
- The four abrupt crash phases above, plus handled `journal-delete` after the committed marker. Pre-commit restart rolls the ledger back and does not report success. Abrupt post-commit restart keeps the publication and replays it. A throw before the marker is asserted as handled rollback. A throw from journal deletion after the marker is asserted as `JOURNAL_CLEANUP_FAILED`: published bytes and the ledger success row stay, the journal stays `committed`, and preimages are not restored. Restart then removes that committed journal without restoring and replays the stored success. A deletion that actually finishes returns the normal apply success and leaves no journal.
- Stale preview and stale token on a new idempotency key are `STALE_REVISION` with `error.details.recovery` when recovery already ran, and schema bytes stay unchanged.
- Dry-run beside a prepared journal leaves the journal and writes nothing. Lock busy is `COMMIT_BUSY`.
- `--recover-only` recovers a supported journal, writes no schema, and appends no upgrade audit line. A v4 vault stays v4.
- `routeNames()` has no init command.

Node 6 ends with `npm test` green and that result recorded in `.agent-runs/issues/23/`. Action commands are not in the route table yet.

## Node 7 — actions

Starts only after node 6 is green. Creates `src/actions.mjs`. Does not edit `src/model-upgrade.mjs`, `src/storage.mjs`, or the factories.

`src/actions.mjs` owns `plan`, `wait`, `unwait`, `update`, `reschedule`, `complete`, `cancel`, `list`, and `get`, plus `validateActions`, the completion event-match, and `contactClock(interaction)`.

`contactClock` is a pure function of one stored interaction. It returns `outbound`, `inbound`, or `unknown`. `recordInteraction` and `recordOutreachSent` in `src/commands.mjs` call it. They do not keep a second copy of the kind rule.

### Validation bridge

Node 5's `validateModel` only checks that each action id starts with `action:` and that the collection is an array. Node 7 adds the structural bridge. `validateModel` calls `validateActions(model, errors)` when `model.actions` is present. `validateActions` appends structural errors for required fields, lowercase enums, duplicate subjects, unknown subject ids, impossible dates, `expected_kind` present only on `external_contact`, and nonempty provenance. It does not call `validateModel` or `loadModel`. It does not move status. `plan`, `wait`, `unwait`, `complete`, and `cancel` remain the only transition owners.

Command functions in `src/actions.mjs` may import `fail` and `loadModel` from `src/model.mjs`. `validateActions` must stay safe to import from `src/model.mjs`: it must not read the vault. Tests call `validateModel` on a model with a broken action and on a model with a valid `open` action. The broken action fails validation. The valid action does not. A direct call does not change status from `open` to `waiting`.

Stored records are snake_case. Payloads are camelCase, using the map in the acceptance doc. Status, category, and kind tokens are lowercase on both sides.

Lifecycle, immutability, provenance, dates, subjects, and attribution follow the acceptance doc. Attribution calls the same association checks as `applyStrategyAttribution` in `src/commands.mjs` and skips the `STRATEGY_NOT_ACTIVE` and `EXPERIMENT_NOT_RUNNING` branches. `experimentId` requires a `cohortId` that is a member of that experiment's `cohorts`. `cohortId` without `experimentId` is `INVALID_COMMAND`. Named strategies must exist. When an experiment is present, each named strategy id must appear in that experiment's `strategy_ids`.

External completion matches the cited interaction's own foreign keys. Derived backlink arrays are not the match. Kind must equal `expected_kind`. `evidence_state` must be `confirmed`. Direction is not required. A parseable `occurred_at` is not required when the stored confirmed row already supports that the event occurred. `interaction record` still requires `occurred_at` on a new confirmed interaction. `completedAt` comes from the payload.

Internal completion accepts a nonempty `result`, an artifact whose `owner_id` or `subject_ids` contains a subject id, or both. An `interactionId` on an internal complete is `INVALID_COMMAND` and does not move clocks. Completion does not insert an interaction and does not change `lifecycle_status` or `pursuit_status`.

`outreach record-sent` stores kind `outreach` and direction `outbound`. Omitted direction and explicit `outbound` both store `outbound`. Any other caller direction is `INVALID_COMMAND` and writes nothing. `interaction record` accepts payload `direction` only for the closed contact-kind set. `application-attempt record-submission` rejects a supplied `direction` before `mutate` and does not feed clocks. Historical rows are not rewritten.

`entity upsert` stays unable to write an action. `ENTITY_TYPES` gains no `action` key. `get --id` does not grow an action branch. Lookup is `action list` and `action get`.

`action list` and `action get` are lock-free, call the rejecting `loadModel`, write nothing, and do not create `actions.json`. List returns the stored array in file order. Get returns one record or `NOT_FOUND`. A missing `--id` is `USAGE`. No filter option is added.

### Routes, catalog, and help in node 7

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

Catalog payload schemas use the camelCase fields and the lowercase enums. `interaction record` gains optional `direction` with enum `outbound` | `inbound`. `outreach record-sent` gains optional `direction` with the same enum, and the invariant that only `outbound` is stored. `application-attempt record-submission` does not gain a direction property. A supplied `direction` is `INVALID_COMMAND`. The catalog invariant says that rejection leaves clocks unchanged.

Help lists `action list` and `action get` with the read-only commands, and the seven mutations with the mutation commands.

Action history `command` values are the route names, such as `action plan`.

### Node 7 tests

File: `test/actions.test.mjs`. Ordinary setups use the v5 `career-vault` fixture. Upgrade-gate and hash cases that need the rich v4 shape import `test/fixtures/vault-v4.mjs` and do not modify it.

The company-with-no-vacancy case does not use `company:acme`. That fixture company owns `opportunity:acme-lead` and an application attempt. The test inserts a synthetic company that has no opportunity and no application attempt, then:

1. `action plan` `external_contact` with `expectedKind` `outreach` and that company as the only subject.
2. `outreach record-sent` stores kind `outreach` and direction `outbound` for that company.
3. `action complete` against that interaction.
4. `action plan` a continuation. Completing the first leaves the continuation `open`.

A separate case plans an action whose only subject is an existing person. The command succeeds. The person record's `company_id` and company membership are unchanged.

Other behavior:

- A confirmed `conversation` with no `direction` completes an action whose `expected_kind` is `conversation`. `contactClock` stays `unknown` for that row, including when `occurred_at` is absent on a stored confirmed row. Neither clock moves. The test classifies the stored interaction. It does not expect new `pipeline status` fields.
- Internal completion with a result, with a linked artifact, and with both, does not insert an interaction, does not change `lifecycle_status` or `pursuit_status`, and does not move the outbound clock. An interaction id on that complete is `INVALID_COMMAND`.
- One interaction cited by two actions completes only the action that was commanded.
- `entity upsert` with type `action` does not write an action. Terminal `completed` and `cancelled` reject later commands with `INVALID_TRANSITION`. `unwait` returns `waiting` to `open` and keeps due date, note, category, subjects, expected kind, and history.
- Contradictory direction on `outreach record-sent` is rejected and writes nothing. Direction on `note`, `application_outcome`, `opportunity_decision`, `strategy_gate_decision`, and `submission` is rejected. Those rows stay out of both clocks.
- Undirected `outreach` and `outreach_sent` with a real `occurred_at` and `evidence_state` `confirmed` classify as outbound. Explicit direction wins over kind. A contact kind without a real `occurred_at`, and an unconfirmed row, stay `unknown`.
- Reject duplicate subjects, unknown subjects, a company-only subject left uncovered by the interaction, kind mismatch, impossible calendar dates, an empty objective, an internal plan that supplies `expectedKind`, and an external plan that omits it.
- `experimentId` without a belonging `cohortId`, and `cohortId` without `experimentId`, are `INVALID_COMMAND`. A draft strategy and a draft experiment may still be stored. The call does not raise `STRATEGY_NOT_ACTIVE` or `EXPERIMENT_NOT_RUNNING`.
- Idempotency replay of an action returns the stored success before `expectedRevision` is checked. A new key with a stale `expectedRevision` is `STALE_REVISION` and writes nothing. `plan` rejects a supplied `expectedRevision`.
- Dry-run writes nothing.
- `validateModel` fails a structurally broken action and accepts a valid `open` action without changing its status.

Read-only test list in the same file:

- `action list` returns the stored array in file order: `{ schemaVersion: 1, status: 'ok', actions }`.
- `action get --id` returns `{ schemaVersion: 1, status: 'ok', action }` or `NOT_FOUND`.
- A missing `--id` is `USAGE`. An extra filter option is `USAGE`.
- On consistent v4, both commands return `VAULT_UPGRADE_REQUIRED` and create no file. Career, snapshot, audit, and ledger hashes stay unchanged. A matching ledger entry and a prepared journal still do not replay or restore.
- On v5 with `actions.json` removed, both return `MODEL_INVALID` and leave the file absent.
- When the records directory is absent, list returns an empty `actions` array, get returns `NOT_FOUND`, and neither creates a file.
- With the commit lock held, both still succeed and do not return `COMMIT_BUSY`.
- The product tree as a data root is `PRODUCT_TREE_NOT_DATA`.
- `command describe` for `action list` and `action get` matches the catalog: read-only, the options above, no filter.

Node 7 ends with `npm test` green and that result recorded in `.agent-runs/issues/23/`.

## Node 8 — operator docs and discovery

Starts only after node 7 is green. Allowed paths are only `docs/cli.md`, `docs/data-layout.md`, `docs/architecture.md`, `docs/stack-conventions.md`, `test/planned-actions-discovery.test.mjs`, and `.agent-runs/issues/23/`. It does not create `test/issue-23-docs.test.mjs`. It does not edit shared source files, factories, or skills.

`docs/cli.md`:

- Commands and JSON examples for `model upgrade-preview`, `model upgrade-apply`, `model upgrade-apply --recover-only`, every `action` route including `action list` and `action get`, and optional `direction` on `interaction record` and `outreach record-sent`.
- Examples use the same camelCase fields and lowercase enums as `COMMAND_CONTRACTS`.
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

`docs/stack-conventions.md` changes one sentence in the Architect checklist. The sentence today says a new required collection should prefer an optional file outside `RECORD_TYPES`. Replace that preference with a pointer to this explicit v4-to-v5 upgrade for a new required collection. Leave every other section of that file unchanged.

`test/planned-actions-discovery.test.mjs` loads `command describe` output, or `COMMAND_CONTRACTS` directly, and the examples in `docs/cli.md`. It asserts those schemas match for `model upgrade-preview`, `model upgrade-apply`, `action list`, `action get`, and the action mutations, including the camelCase map and optional `direction` on eligible `interaction record` kinds. It asserts the catalog or docs state that there is no downgrade and that a previous binary can force version 4 and eight counts. It asserts `action list` and `action get` are present and read-only. A test that only checks that a doc file contains a word is not this test. The test does not parse a private vault and does not create a data root.

Node 8 ends with `npm test` green and that result recorded in `.agent-runs/issues/23/`.

## Node 9 — tester

Starts only after node 8 is green. Runs `npm test` and records the command result only in `.agent-runs/issues/23/`. It does not edit tracked product files, skills, or workflow config. If `npm test` fails, the node stops and reports the failure. It does not patch around it.

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
- Replacing ordinary `recoverTransactions` with inspect-all recovery. Ordinary v5 `mutate` still calls `recoverTransactions`, after the version guard. Upgrade uses `inspectDomainJournals` and `restoreDomainJournals`.
- Marking the acceptance doc, the ADR, or this plan accepted from this correction.

## Stop

The independent Codex findings named in the origin packet are applied in these proposed docs. This correction does not claim that review passed and does not record design acceptance. Graph node 4 is still the only node that may change status from proposed to accepted, and only when its dispatch contains the origin's recorded design-acceptance authority. Do not dispatch nodes 5 through 9 until that acceptance is recorded. Do not implement product code from this plan until that gate is recorded.
