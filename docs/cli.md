# CLI contract

`nextstep` is designed for humans and any local agent environment. Commands use JSON stdout and JSON stderr. They do not depend on Codex-specific thread state.

## Root resolution

Precedence is `--data-root`, the nearest ancestral `nextstep.yaml`, nearest ancestor vault layout discovery, then `cwd` fallback. No environment variable selects the data root or state root. The selected root must contain a `Master/` directory and a `Candidatures/records/manifest.json` file when initialized; when the current directory is not an initialized vault, read commands return empty results with `vaultState: "uninitialized"`, `get` returns `NOT_FOUND`, `doctor` reports `degraded`, and mutations fail with `VAULT_NOT_INITIALIZED`. Fallback to `cwd` is refused when `cwd` is inside the Nextstep product source tree (`PRODUCT_TREE_NOT_DATA`). An invalid nearest marker fails closed and does not fall back to another vault.

## Holoself root

Nextstep runs the external `holoself` CLI with `--project` set to the data root and `--self-only`. Holoself alone owns and resolves personal context lens selection (Nextstep does not pass `--lens`); Nextstep propagates whichever lens is returned in the context packet. Nextstep does not configure a Holoself home: the child process inherits Nextstep's environment unchanged, so any Holoself-specific setting already present there (for example `HOLOSELF_HOME`) reaches Holoself as-is. Nextstep never reads Holoself files itself.

## Candidate profile

```text
nextstep candidate-profile show --json
nextstep candidate-profile upsert --input -
```

`candidate-profile show` reads the optional `Candidatures/records/candidate-profile.json` singleton; `profile` is `null` when none exists. `candidate-profile upsert` writes it through the normal mutation envelope (lock, audit, journal, `--dry-run`), with `record.display_name`, `record.target_roles` (1-5), `record.positioning`, optional `record.flagship_facts` (0-5), and `record.source_preference` (`auto` default, or `native`). There is exactly one candidate per vault, at the fixed id `candidate-profile:self`; updates require envelope `expectedRevision` against the stored `source_revision`.

This is a thin native fallback, never a résumé: voice, story bank, claims, and evidence writeups stay in an external tool such as Holoself. `context build`'s `packet.self` never duplicates it. Resolution order, used by every `self` consumer: `source_preference: "native"` answers from the card without ever calling Holoself; otherwise Holoself is tried first and a successful result always wins (`source: "holoself"`); a card is used only when Holoself is not installed at all (`source: "native"`, `documents: []`); any other Holoself failure (misconfiguration, timeout, malformed output) leaves `self: null` and the command `degraded`, even with a card on disk — it is never silently substituted for a real but broken Holoself setup. `doctor`'s `candidateProfile` check reports `activeSource: holoself|native|absent`; a native card active while Holoself is unavailable does not fail `doctor`'s overall health.

## Dry-run for mutations

Every envelope mutation except `run record` accepts `--dry-run`. It validates the envelope against the current records and returns the would-be result with `status: "dry_run"`, without taking the commit lock or changing records, ledger or audit.

`validate --scope all` adds a `DANGLING_MASTER_REFERENCE` warning for provenance that cites a missing `Master/` file. It is advisory: historical records are never rewritten and validation still passes.

## Linked tool integration

`--profile-root` defaults to `%LOCALAPPDATA%\Nextstep\integration` for `integration` and `doctor --integration`. `link` repairs a managed junction whose directory was deleted; if the profile is `broken` because its target disappeared, run `integration unlink` and then `link`. `doctor --integration` lists `stalePathEntries`: PATH directories named `Nextstep\integration\bin` that do not exist.

These commands operate without a data root and never read career records:

```text
nextstep integration plan --product-root <absolute-path> --profile-root <absolute-path> [--workspace-root <absolute-path>] [--manage-user-path] --json
nextstep integration link --product-root <absolute-path> --profile-root <absolute-path> [--workspace-root <absolute-path>] [--manage-user-path] --json
nextstep integration status --profile-root <absolute-path> [--workspace-root <absolute-path>] --json
nextstep integration unlink --profile-root <absolute-path> [--workspace-root <absolute-path>] --json
nextstep doctor --integration [--profile-root <absolute-path>] [--workspace-root <absolute-path>] --json
```

`plan` previews the launcher and optional user PATH change. `link` creates the managed launcher junction and, with `--manage-user-path`, appends its directory to the user PATH. It never creates skill links, even with `--workspace-root`. Skills Manager owns skill deployment; see [distribution](skill-distribution.md).

`integration unlink --scope skills --dry-run --profile-root <absolute-path> --json` previews removal of previously registered workspace skills. Remove `--dry-run` to apply with a recovery journal and rollback receipt, preserving launcher, PATH, project marker and data. Rerun after interruption to resume. `integration restore-skills --profile-root <absolute-path> [--dry-run] --json` restores that receipt only into unchanged destinations; this is an explicit rollback, not normal installation. Full `integration unlink` still removes the CLI and owned PATH segment.

`status` reports remaining registered links and recovery state. `doctor --integration` reports external skill management separately from CLI health: it does not claim global deployment or host activation from workspace inspection.

Bind a private instance separately:

```text
nextstep project plan --data-root <absolute-path> --instance-id <id> --profile-root <absolute-path> --json
nextstep project link --data-root <absolute-path> --instance-id <id> --profile-root <absolute-path> --json
nextstep project status [--data-root <absolute-path>] --profile-root <absolute-path> --json
nextstep project unlink --data-root <absolute-path> --profile-root <absolute-path> --json
```

The marker contains only schema version, instance ID, and `data_root: .`. `project unlink` removes only an unchanged marker owned by the current installation. It never removes career data or disposable `.nextstep/` state. `doctor --integration` can diagnose tool, PATH, skill link, marker, Holoself availability, and pending recovery without first resolving a vault.

The local `integration-v1.json` registry stores machine-specific paths and ownership. It belongs in the profile directory, outside a private data vault and outside the product tree. A cloud-synchronized profile receives a warning because links must be recreated on each machine.

## Mutations

Mutation commands read this envelope from stdin:

```json
{
  "schemaVersion": 1,
  "requestId": "agent-visible-request-id",
  "idempotencyKey": "stable-retry-key",
  "actor": "codex:thread-id",
  "expectedRevision": 3,
  "payload": {}
}
```

The same idempotency key may safely retry the same command. Reuse for a different command fails. `expectedRevision` is required only for commands that update an existing versioned entity.

Mutation payloads are command-specific and explicit:

| Command | Required payload |
|---|---|
| `entity upsert` | `type`, complete `record`; include envelope `expectedRevision` when replacing an existing entity |
| `strategy create` | complete Strategy `record`; status defaults to `draft` |
| `strategy update` | `strategyId`, partial non-lifecycle `changes`; envelope `expectedRevision` is required |
| `strategy set-status` | `strategyId`, `status`; envelope `expectedRevision`; terminal status also requires `conclusion` |
| `experiment create` | complete Experiment `record`; status defaults to `draft` |
| `experiment update` | `experimentId`, partial non-lifecycle `changes`; envelope `expectedRevision` is required |
| `experiment set-status` | `experimentId`, `status`; envelope `expectedRevision`; terminal status also requires `conclusion` |
| `artifact register` | complete artifact `record` pointing to an existing vault file |
| `artifact adopt` | `artifactId`, `authorship`; optionally `expectedSha256` |
| `artifact record-qa` | `artifactId`, external QA `manifest`; optionally `expectedSha256` |
| `artifact record-review` | `artifactId`, a workflow-template `review` (`templateId`, `status` of `passed`/`flagged`, optional `lens`/`notes`); optionally `expectedSha256` |
| `candidate-profile upsert` | `record` (`display_name`, `target_roles`, `positioning`, optional `flagship_facts`, `source_preference`); envelope `expectedRevision` required when updating an existing card |
| `interaction record` | interaction `record`; confirmed outreach also requires `channel`, `recipient`, `objective`, and may include `messageArtifactId`; optional payload `direction` (`outbound` or `inbound`) only for an eligible contact kind |
| `opportunity record-decision` | Opportunity/ApplicationAttempt `subjectId`, `decision`, `decidedAt`, and `reasonCodes`; a user-directed exception also requires the original recommendation and rationale |
| `outreach record-sent` | `channel`, `recipient`, `objective`, `occurredAt`, a relational subject, and optionally `messageArtifactId`; omitted `direction` and explicit `outbound` both store kind `outreach` and direction `outbound` |
| `model upgrade-apply` | `token` returned by `model upgrade-preview` |
| `action plan` | `category`, `subjects`, `objective`; `external_contact` also requires `expectedKind` |
| `action wait` | `id` and envelope `expectedRevision` |
| `action unwait` | `id` and envelope `expectedRevision` |
| `action update` | `id`, plus `objective`, `note`, or both, and envelope `expectedRevision` |
| `action reschedule` | `id`, `dueOn`, and envelope `expectedRevision` |
| `action complete` | `id`, `completedAt`, completion evidence, and envelope `expectedRevision` |
| `action cancel` | `id`, nonempty `reason`, and envelope `expectedRevision` |
| `application-attempt register-package` | optional new Company/Opportunity/ApplicationAttempt `records` plus existing contained artifact files; at least one record or artifact is required |
| `application-attempt record-submission` | `applicationAttemptId`, `channel`, exactly one of `occurredAt` or `occurredOn`, and explicit `artifactSelection` evidence |
| `application-attempt reconcile-submission` | existing `submissionId`, confirmed `artifactSelection`, and envelope `expectedRevision` |
| `application-attempt close` | `applicationAttemptId`, terminal lifecycle, `outcome`, `reason`, and envelope `expectedRevision`; an outcome date is optional and never inferred |
| `run record` | privacy-safe operational `run` manifest; writes only disposable runtime state |

Confirmed outreach and submissions freeze the exact supplied clean artifact bytes. A selected file with an unadopted revision fails rather than being silently adopted. Nextstep generates transmission metadata; callers do not construct snapshot paths or hashes.

`application-attempt register-package` does not draft. It atomically registers new relational records and externally authored files, creates immutable initial snapshots, and fails without partial state when any supplied record or file is invalid. Existing records must be omitted and managed through their dedicated commands.

Use `command describe --command "application-attempt register-package" --json` for the complete minimal record and artifact shapes. Artifact paths are relative to `Candidatures/`, such as `artifacts/opportunities/example-role/fit-analysis.md`.

Submission artifact evidence is explicit: `unknown`, `confirmed_none`, or `confirmed` with non-empty artifact IDs. Date-only confirmation uses `occurredOn` and remains date-only; the CLI never invents noon or the recording time. An unknown selection may later transition once through `application-attempt reconcile-submission`, which freezes the confirmed bytes without generic record replacement.

## Discovery, readiness, and workflow views

These commands are read-only and do not authorize a mutation:

```text
nextstep command describe --command "<command name>" --json
nextstep model upgrade-preview --json
nextstep action list --json
nextstep action get --id <action:id> --json
nextstep workflow templates [--category <category>] --json
nextstep workflow template --id <workflow-template:id> --json
nextstep readiness --intent analyze|outreach|package|submit|close --subject <typed-id> --json
nextstep application-attempt submission-plan --id <application-attempt:id> --json
nextstep pipeline status [--stale-after-days <integer>=14] --json
nextstep candidate-profile show --json
```

`command describe` returns the command mode, options or mutation envelope, payload schema, invariants, and stable error taxonomy. It is the authoritative agent discovery path; callers should not inspect source code or tests to reconstruct payloads.

Workflow templates normalize opportunity evidence, one-screen decisions, application-attempt packages and channels, recruiter scans, submission confirmations, outcome closures, and structural contracts for executive CVs, application-attempt letters, form answers, and executive outreach. ApplicationAttempt and drafting context packets embed their relevant contracts, so correctness does not depend on a separately installed skill or extra lookup. They never generate prose.

`readiness` reports current revision, embedded workflow contracts, existing artifacts, required input, active gates, unresolved evidence, and the smallest relevant validation scope. `application-attempt submission-plan` reports every attempt-owned artifact, clean/final eligibility, QA state, visual readiness, prior transmission, ambiguous roles, and cold-apply gate state.

`pipeline status` is the only portfolio-wide view: a lock-free rollup across every Opportunity and ApplicationAttempt, split into `byStatus`/`activeTotal`/`closedByStatus`/`closedTotal`, plus a `subjects` list (one row per subject, sorted by `daysSinceLastConfirmed` descending with nulls last, then `id`) reporting `lastConfirmedAt`, `daysSinceLastConfirmed`, and a `stale` flag computed only from confirmed Interactions (`evidenceBoundary: 'confirmed-events-only'`) against a `--stale-after-days` threshold (default 14; `0` is valid). A subject with no confirmed Interaction yet reports `daysSinceLastConfirmed: null` and is never `stale`; a closed subject (`rejected`/`withdrawn`/`not_pursued`/`closed`) is never `stale` regardless of age, though it is still counted in its `closedByStatus` bucket. `status` always stays `'ok'` — staleness is not a health failure, unlike `doctor`'s `'degraded'`. Like `readiness`, this command is `advisory: true`, takes no commit lock, and can observe a torn read across a concurrent mutation's sequential per-file writes.

Interactions and submissions accept optional payload `strategyIds`. Experiment attribution additionally requires both `experimentId` and a valid `cohortId`. Callers do not place these fields directly in an Interaction record.

Confirmed execution may be attributed only to an `active` Strategy and, when used, a `running` Experiment. Planned evidence may be prepared before activation but does not count in evaluation.

A submission attributed to `strategy-definition:cold-apply` requires a prior confirmed `strategy_gate_decision` Interaction related to its ApplicationAttempt or Opportunity. Its `gate_decision` records `decision` (`pass`, `mitigate`, or `stop`), `checked_at`, `unresolved_gap_count`, and `evidence_or_mitigation`. `stop` blocks submission; `parameters.maximum_unresolved_hard_gaps` is enforced when configured.

## Strategy and experiment commands

Public definitions are read-only and do not need a data root:

```text
nextstep strategy definitions [--category <category>] --json
nextstep strategy definition --id <strategy-definition:id> --json
```

Private read commands require a data root:

```text
nextstep strategy list [--status <status>] [--definition <id>] [--subject <typed-id>] --json
nextstep strategy get --id <strategy:id> --json
nextstep strategy guide --id <strategy:id> [--phase <phase>] [--subject <typed-id>] --json
nextstep strategy evaluate --id <strategy:id> --json
nextstep experiment list [--status <status>] [--strategy <strategy:id>] --json
nextstep experiment get --id <experiment:id> --json
nextstep experiment evaluate --id <experiment:id> --json
```

`strategy guide` combines the immutable definition with the private objective and parameters. `evaluate` uses confirmed attributed events only and reports unmeasured metrics explicitly.

Lifecycle mutations are separate from content updates. Strategy states are `draft`, `active`, `paused`, `completed`, and `abandoned`; Experiment states are `draft`, `running`, `paused`, `completed`, and `abandoned`. Terminal records cannot reopen.

## Concurrency

Read-only commands never lock. Mutations do not wait on other tasks: a short conflicting commit returns `COMMIT_BUSY`, allowing the caller to retry. Locks and transaction recovery are internal runtime details.

## Documents

`artifact status` detects direct edits. `artifact adopt` records a new user, AI, or mixed revision and snapshots its exact bytes. Structural checks reject empty or malformed DOCX/PDF containers. Visual rendering is not part of the default command path.

`artifact contract-check --artifact <id> --template workflow-template:executive-cv` checks canonical Markdown for stable headings/order, obvious opportunity-title mirroring, and declared canonical phrases before rendition generation. It is read-only and does not attempt semantic rewriting.

`artifact record-qa` records evidence supplied by an external renderer. The manifest binds the canonical source SHA-256, derived artifact SHA-256, capability/template versions, and structural, accessibility, parity, and visual results. Nextstep computes `generated`, `structurally_verified`, or `visually_verified`; a later submission is exposed separately as `transmitted` by the submission plan.

## Workflow-template reviews

`artifact record-review` attaches a judgment-based workflow-template review (for example `workflow-template:recruiter-scan`) to a clean artifact, binding the artifact's current SHA-256 to a recorded `status` of `passed` or `flagged`. Unlike QA, a review is never computed from the file — it captures an external agent's judgment, with an optional review perspective (`lens`) and free-text `notes`. Schema field names remain unchanged.

An artifact opts in by listing the template IDs it should satisfy in `document.contract.templates`. When it does, `application-attempt submission-plan` and `readiness --intent submit` report each declared template's review status (`passed`, `flagged`, `stale` when the artifact changed since the review, or `missing`) and add an advisory line to `unresolvedEvidence` if any eligible (clean, `state: final`) artifact's review isn't `passed`. This is a soft nudge, not a gate: it never changes an artifact's `eligible` flag or the plan's overall readiness.

## Privacy-safe run metrics

```text
nextstep run record --input -
nextstep run list [--limit <1-100>] --json
```

Run manifests live under disposable `.nextstep/runs/`. They may contain timing, tool family, command/error code, retries, cache hits, source/context digests, validation scope, and QA status. Unknown fields are rejected, and names associated with prompts, responses, content, messages, credentials, secrets, or tokens fail closed.

## Context budgets

`context build` accepts the stable intents `analyze`, `outreach`, `drafting`, `application`, and `interview`. Every packet embeds the applicable workflow contracts and authorization boundary. `small` and `standard` return deliberately bounded excerpts; use `deep` only when the task genuinely needs broader evidence. `packet.self` is resolved per the [candidate profile](#candidate-profile) rules (Holoself queried with `--self-only` without a lens default/forwarding, propagating the returned lens, or the native card), while Opportunity, Company, Person, ApplicationAttempt, Artifact, and active subject-related Strategy context is selected relationally by Nextstep. Pass `--strategy <strategy:id>` for an explicit selection.

Generated relational indexes cover registered entities and artifacts under `Candidatures/`. Use `master catalog` for current local Markdown paths, titles, sizes and SHA-256 values. Use `master query --query "interview questions" --limit 10 --max-chars 2000` for case-insensitive literal token AND matching in paths and content. These read-only commands do not change `context build`, invoke Holoself, or persist an index. Results report total matches, bounded excerpts, truncation and exclusions: Archive directories, hidden entries, links and non-Markdown files. Limits: query 200 characters; 1–50 results; 1–8000 characters per excerpt; 2 MiB/file, 32 MiB total, 1000 Markdown documents, 10000 directory entries and depth 20. Invalid UTF-8, unsafe paths, concurrent file changes and exceeded limits fail explicitly. No match does not prove absence from excluded sources.

Commands and options are strict. Unknown positionals and misspelled options return `USAGE` rather than being interpreted or ignored.

## Adaptive applicant guidance

Read-only `guidance` supports optional applicant questions, research/repair actions, and scoped answer reuse. `guidance record` explicitly persists a private brief Artifact. Personal context reports coverage; detailed reviews preserve criterion evidence; submissions support explicit unknown time/channel and later reconciliation. See [adaptive guidance](adaptive-guidance.md) for contracts, examples, and boundaries.

## Planned actions

A planned action is a next step the operator still has to take. It is not an interaction, an application close, or a strategy or experiment terminal. `action plan` creates an `open` action. `action wait` moves `open` to `waiting`. `action unwait` moves `waiting` to `open` and keeps the due date, note, category, subjects, expected kind, and history. `action update` edits objective and note while the action is `open` or `waiting`, and it cannot make the objective empty. `action reschedule` sets or clears `due_on` while the action is `open` or `waiting`. `action complete` and `action cancel` run only from `open` or `waiting`. Both are terminal. `cancel` requires a nonempty reason. A later action command on `completed` or `cancelled` is `INVALID_TRANSITION`.

`plan` rejects envelope `expectedRevision`. Every later action mutation requires it. Idempotency replay returns the stored success before that revision check. A new key with a stale `expectedRevision` is `STALE_REVISION` and writes nothing. `--dry-run` writes nothing.

Category is required, nonempty, and caller-supplied: `internal` or `external_contact`. It is immutable. Subject type does not classify it. Subjects are a nonempty set of existing company, person, opportunity, or application-attempt ids. Duplicate type-plus-id pairs are rejected. Subjects are immutable. A company alone or a person alone is valid. A person subject does not write `company_id` or company membership.

`external_contact` requires immutable `expectedKind` from `outreach`, `outreach_sent`, `outreach_response`, `human_response`, `conversation`, `interview`, or `screen`. `internal` omits `expectedKind`. Objective is required and nonempty.

Every stored action has nonempty provenance: `actor`, `created_at`, `updated_at`, `source_revision`, and append-only `history`. `created_at` is set once from the command clock. `updated_at` changes on every successful mutation. Both are real UTC date-times. `due_on` is a real `YYYY-MM-DD` date or absent. Impossible calendar dates are rejected. `completedAt` is required on complete, is stored from the payload, and is not copied from an interaction.

Optional `strategyIds`, `experimentId`, and `cohortId` are attribution only. When present they must exist. `experimentId` requires a `cohortId` that belongs to that experiment, and `cohortId` requires `experimentId`. Each named strategy on that experiment must be one of the experiment's strategies. Storing them does not count as execution, does not apply confirmed-event status gates, and does not move clocks.

`action list` and `action get` are lock-free, write nothing, and do not create `actions.json`. `action list` returns stored actions in file order: `{ "schemaVersion": 1, "status": "ok", "actions": [] }`. `action get` returns one stored action or `NOT_FOUND`: `{ "schemaVersion": 1, "status": "ok", "action": {} }`. A missing `--id` is `USAGE`. Neither command accepts a filter. On a consistent schema_version 4 vault both return `VAULT_UPGRADE_REQUIRED`. When the records directory is absent, list returns an empty `actions` array, get returns `NOT_FOUND`, and neither creates a file.

Completion is an event match or internal evidence. Direction and a clock-usable time are clock classification, not completion evidence. External completion cites an existing interaction with `evidence_state` `confirmed`, `kind` equal to `expected_kind`, and every action subject covered by that interaction's own `company_id`, `person_ids`, `opportunity_id`, and `application_attempt_id`. Extra foreign keys may exist. Derived backlink arrays are not the match. A confirmed conversation or interview completes an action whose expected kind is that kind, including when direction and a clock-usable `occurred_at` are absent. Internal completion requires a nonempty `result`, an artifact id already linked to one of the subjects, or both. An interaction id is not internal evidence and does not move contact clocks. Completion does not insert an interaction and does not change `lifecycle_status` or `pursuit_status`. One interaction may be cited by several actions. Completing one leaves the others unchanged.

`entity upsert` cannot create or replace an action. Parent career files and generated index pages do not gain action backlinks.

There is no new init command. Upgrade does not create a vault.

## Payload field map

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

## Vault upgrade

An existing eight-collection vault stays on manifest `schema_version` 4 until the operator runs `model upgrade-preview` and then `model upgrade-apply` with that token. Ordinary reads and writes on a consistent version 4 vault, including `doctor`, `--dry-run`, `action list`, and `action get`, fail with `VAULT_UPGRADE_REQUIRED` and write nothing. The message is: Vault schema_version 4 requires an explicit upgrade. Run model upgrade-preview, then model upgrade-apply with that token. Details are `{ "schemaVersion": 4, "previewCommand": "model upgrade-preview", "applyCommand": "model upgrade-apply" }`. `doctor` uses that error envelope and exits 1.

`model upgrade-preview` is lock-free and writes nothing. A pending domain journal is `PENDING_JOURNAL` and no token is issued. The message is: A pending domain journal must be recovered before a preview token can be issued. Details include `{ "recoverCommand": "model upgrade-apply --recover-only" }`.

A missing token is INVALID_COMMAND before the lock and does not recover. A forgotten token is not --recover-only. `model upgrade-apply --recover-only` preflights every journal, recovers supported journals, writes no schema, and appends no upgrade audit line. It is how a pending journal is cleared when preview refuses a token. Combining `--recover-only` with `--input` or `--dry-run` is `USAGE` and does not recover.

No downgrade command exists. A previous binary can force schema_version 4 and eight counts on a v5 vault. This product does not repair that.

Vault schema_version 5 is not a submission-bundle version. Submission bundles stay on their own evidence versions.

Apply of a matching version 4 token writes only the preview write set: canonical empty `actions.json` when that file was absent, manifest `schema_version` 5 with `counts.actions` 0, projected index bytes that would change, one ledger record, and one audit line appended after the previous audit prefix. The eight career files, snapshots, submission bundles, and transmission bytes stay byte-identical. A matching version 5 token writes nothing, including no ledger append. Replay of a committed upgrade returns the stored success after recovery and before the source token is compared. That response adds top-level `currentRecovery` for journals this call restored or dropped, and it leaves the stored `schemaChanged` and `recovery` as they were.

## Command examples

Examples below use the same camelCase fields and lowercase enums as `command describe`. Pass mutation JSON on stdin with `--input -`.

### `model upgrade-preview`

```text
nextstep model upgrade-preview --json
```

```json command-output
{
  "schemaVersion": 1,
  "status": "ok",
  "token": {
    "schemaVersion": 1,
    "vaultSchemaVersion": 4,
    "manifestSha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "careerFileSha256": {
      "companies.json": "0000000000000000000000000000000000000000000000000000000000000000",
      "opportunities.json": "0000000000000000000000000000000000000000000000000000000000000000",
      "application-attempts.json": "0000000000000000000000000000000000000000000000000000000000000000",
      "people.json": "0000000000000000000000000000000000000000000000000000000000000000",
      "interactions.json": "0000000000000000000000000000000000000000000000000000000000000000",
      "artifacts.json": "0000000000000000000000000000000000000000000000000000000000000000",
      "strategies.json": "0000000000000000000000000000000000000000000000000000000000000000",
      "experiments.json": "0000000000000000000000000000000000000000000000000000000000000000"
    },
    "actionsSha256": null,
    "snapshotAndTransmissionSha256": {},
    "currentIndexSha256": {},
    "auditPrefixSha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "ledgerPreimage": { "present": false, "sha256": null },
    "writeSet": {
      "actionsJson": "create-empty",
      "manifest": "rewrite-v5",
      "projectedIndexSha256": {},
      "ledger": "append-or-replace-record",
      "audit": "append-one-line"
    }
  }
}
```

```json vault-upgrade-required
{
  "schemaVersion": 4,
  "previewCommand": "model upgrade-preview",
  "applyCommand": "model upgrade-apply"
}
```

```json pending-journal
{
  "recoverCommand": "model upgrade-apply --recover-only"
}
```

Invariants:
- Lock-free. Writes nothing and does not take the commit lock.
- Accepts a consistent schema_version 4 or 5 vault. Malformed versions and unreadable records are rejected. Any pending domain journal is PENDING_JOURNAL and no token is issued.
- The token binds the manifest, eight career files, actions.json when present, snapshot and transmission bytes, current index bytes, the audit prefix, the ledger preimage, and the exact write set.
- A schema_version 4 write set rewrites the manifest to version 5, creates or keeps canonical empty actions.json, names projected index bytes, and appends one ledger record and one audit line. It has no delete list.
- A schema_version 5 write set is actionsJson unchanged, manifest unchanged, projectedIndexSha256 empty, ledger none, and audit none.
- Career collection files, snapshot bytes, and transmission bytes are outside the write set.
- No downgrade command exists. A previous binary can force schema_version 4 and eight counts on a v5 vault. This product does not repair that.

### `model upgrade-apply`

```text
nextstep model upgrade-apply --input - --json
nextstep model upgrade-apply --input - --dry-run --json
nextstep model upgrade-apply --recover-only --json
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "upgrade-apply-1",
  "idempotencyKey": "upgrade-apply-1",
  "actor": "user",
  "payload": {
    "token": {
      "schemaVersion": 1,
      "vaultSchemaVersion": 4,
      "manifestSha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "careerFileSha256": {
        "companies.json": "0000000000000000000000000000000000000000000000000000000000000000",
        "opportunities.json": "0000000000000000000000000000000000000000000000000000000000000000",
        "application-attempts.json": "0000000000000000000000000000000000000000000000000000000000000000",
        "people.json": "0000000000000000000000000000000000000000000000000000000000000000",
        "interactions.json": "0000000000000000000000000000000000000000000000000000000000000000",
        "artifacts.json": "0000000000000000000000000000000000000000000000000000000000000000",
        "strategies.json": "0000000000000000000000000000000000000000000000000000000000000000",
        "experiments.json": "0000000000000000000000000000000000000000000000000000000000000000"
      },
      "actionsSha256": null,
      "snapshotAndTransmissionSha256": {},
      "currentIndexSha256": {},
      "auditPrefixSha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "ledgerPreimage": { "present": false, "sha256": null },
      "writeSet": {
        "actionsJson": "create-empty",
        "manifest": "rewrite-v5",
        "projectedIndexSha256": {},
        "ledger": "append-or-replace-record",
        "audit": "append-one-line"
      }
    }
  }
}
```

```json command-output
{
  "schemaVersion": 1,
  "requestId": "upgrade-apply-1",
  "status": "applied",
  "changedEntities": [],
  "revision": null,
  "warnings": [],
  "unresolvedEvidence": [],
  "nextActions": [],
  "recovery": { "performed": false, "journals": 0 },
  "schemaChanged": true
}
```

```json recover-only
{
  "schemaVersion": 1,
  "status": "ok",
  "recovery": { "performed": false, "journals": 0 },
  "schemaChanged": false
}
```

```json replay
{
  "replayed": true,
  "schemaChanged": true,
  "recovery": { "performed": false, "journals": 0 },
  "currentRecovery": { "performed": true, "journals": 1 }
}
```

Invariants:
- A missing token is INVALID_COMMAND before the lock and does not recover. A forgotten token is not --recover-only.
- --recover-only cannot be combined with --input or --dry-run. It preflights every journal, recovers supported journals, writes no schema, and appends no upgrade audit or ledger record.
- Under the lock, every journal is preflighted before recovery and before the ledger is trusted. An unsafe, unknown, or unreadable journal is UNSAFE_JOURNAL and rejects the whole set before any restore.
- The same idempotency digest returns the stored success after recovery and before source-token comparison. Replay adds top-level currentRecovery and does not rewrite the stored schemaChanged or recovery.
- currentRecovery is present only on a replayed apply success. A fresh apply stores recovery and schemaChanged and does not add currentRecovery.
- A matching schema_version 5 token writes nothing, including no ledger append. A matching schema_version 4 token writes only the preview write set.
- No downgrade command exists. A previous binary can force schema_version 4 and eight counts on a v5 vault. This product does not repair that.
- --dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.

### `action list`

```text
nextstep action list --json
```

```json command-output
{
  "schemaVersion": 1,
  "status": "ok",
  "actions": []
}
```

Invariants:
- Lock-free. Returns stored actions in file order. Writes nothing and does not create actions.json.
- A consistent schema_version 4 vault is VAULT_UPGRADE_REQUIRED. No filter is accepted.

### `action get`

```text
nextstep action get --id action:follow-up --json
```

```json command-output
{
  "schemaVersion": 1,
  "status": "ok",
  "action": {}
}
```

Invariants:
- Lock-free. Returns one stored action or NOT_FOUND. A missing --id is USAGE.
- Writes nothing and does not create actions.json. No filter is accepted.

### `action plan`

```text
nextstep action plan --input - --json
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "plan-1",
  "idempotencyKey": "plan-1",
  "actor": "user",
  "payload": {
    "category": "external_contact",
    "subjects": [{ "type": "company", "id": "company:example" }],
    "objective": "Send the introduction",
    "expectedKind": "outreach",
    "dueOn": "2026-10-28"
  }
}
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "plan-internal-1",
  "idempotencyKey": "plan-internal-1",
  "actor": "user",
  "payload": {
    "category": "internal",
    "subjects": [{ "type": "person", "id": "person:example" }],
    "objective": "Draft the note"
  }
}
```

Invariants:
- category is caller-supplied and immutable: internal or external_contact. Subject type does not classify it.
- external_contact requires expectedKind. internal omits expectedKind.
- subjects are an immutable nonempty set. A company alone or a person alone is valid. A person subject does not write company_id or company membership.
- Payload fields are camelCase: expectedKind, dueOn, completedAt, interactionId, artifactId, strategyIds, experimentId, cohortId. Stored fields are snake_case. Status, category, and kind tokens are lowercase.
- Optional strategyIds, experimentId, and cohortId are attribution only. experimentId requires a cohortId that belongs to that experiment. cohortId requires experimentId. Status gates are not applied.
- plan rejects expectedRevision. source_revision starts at 0.
- --dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.

### `action wait`

```text
nextstep action wait --input - --json
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "wait-1",
  "idempotencyKey": "wait-1",
  "expectedRevision": 0,
  "actor": "user",
  "payload": {
    "id": "action:follow-up"
  }
}
```

Invariants:
- Envelope expectedRevision is required. Moves open to waiting.
- --dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.

### `action unwait`

```text
nextstep action unwait --input - --json
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "unwait-1",
  "idempotencyKey": "unwait-1",
  "expectedRevision": 1,
  "actor": "user",
  "payload": {
    "id": "action:follow-up"
  }
}
```

Invariants:
- Envelope expectedRevision is required. Moves waiting to open and keeps due date, note, category, subjects, expected kind, and history.
- --dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.

### `action update`

```text
nextstep action update --input - --json
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "update-1",
  "idempotencyKey": "update-1",
  "expectedRevision": 1,
  "actor": "user",
  "payload": {
    "id": "action:follow-up",
    "objective": "Send the revised introduction",
    "note": "Keep the same subjects"
  }
}
```

Invariants:
- Envelope expectedRevision is required. Edits objective, note, or both while open or waiting. An update cannot make objective empty. note null clears the note.
- --dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.

### `action reschedule`

```text
nextstep action reschedule --input - --json
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "reschedule-1",
  "idempotencyKey": "reschedule-1",
  "expectedRevision": 2,
  "actor": "user",
  "payload": {
    "id": "action:follow-up",
    "dueOn": "2026-11-02"
  }
}
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "reschedule-clear-1",
  "idempotencyKey": "reschedule-clear-1",
  "expectedRevision": 3,
  "actor": "user",
  "payload": {
    "id": "action:follow-up",
    "dueOn": null
  }
}
```

Invariants:
- Envelope expectedRevision is required. Sets or clears due_on while open or waiting. Impossible calendar dates are rejected.
- --dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.

### `action complete`

```text
nextstep action complete --input - --json
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "complete-1",
  "idempotencyKey": "complete-1",
  "expectedRevision": 0,
  "actor": "user",
  "payload": {
    "id": "action:follow-up",
    "completedAt": "2026-10-21T15:00:00.000Z",
    "interactionId": "interaction:example"
  }
}
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "complete-internal-1",
  "idempotencyKey": "complete-internal-1",
  "expectedRevision": 0,
  "actor": "user",
  "payload": {
    "id": "action:draft",
    "completedAt": "2026-10-21T15:00:00.000Z",
    "result": "The note is ready"
  }
}
```

Invariants:
- Envelope expectedRevision is required. completedAt is a real UTC date-time and is not copied from an interaction.
- external_contact completion cites a confirmed interaction whose kind equals expectedKind and whose own company_id, person_ids, opportunity_id, and application_attempt_id cover every subject.
- internal completion requires a nonempty result, an artifact already linked to a subject, or both. An interaction id is not internal evidence.
- Completion does not insert an interaction and does not change lifecycle_status or pursuit_status.
- --dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.

### `action cancel`

```text
nextstep action cancel --input - --json
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "cancel-1",
  "idempotencyKey": "cancel-1",
  "expectedRevision": 0,
  "actor": "user",
  "payload": {
    "id": "action:follow-up",
    "reason": "No longer useful"
  }
}
```

Invariants:
- Envelope expectedRevision is required. cancel runs from open or waiting and is terminal.
- --dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.

### `interaction record`

Optional `direction` is a payload field beside `record`. It is stored only for an eligible contact kind.

```text
nextstep interaction record --input - --json
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "interaction-direction-1",
  "idempotencyKey": "interaction-direction-1",
  "actor": "user",
  "payload": {
    "record": {
      "id": "interaction:example-conversation",
      "kind": "conversation",
      "evidence_state": "confirmed",
      "occurred_at": "2026-10-21T15:00:00.000Z",
      "company_id": "company:example",
      "person_ids": ["person:example"]
    },
    "direction": "inbound"
  }
}
```

Invariants:
- direction is optional and is stored only for contact kinds outreach, outreach_sent, outreach_response, human_response, conversation, interview, and screen. Direction on any other kind is INVALID_COMMAND.
- --dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.

### `outreach record-sent`

```text
nextstep outreach record-sent --input - --json
```

```json command-input
{
  "schemaVersion": 1,
  "requestId": "record-sent-1",
  "idempotencyKey": "record-sent-1",
  "actor": "user",
  "payload": {
    "channel": "email",
    "recipient": "person:example",
    "objective": "Send the introduction",
    "occurredAt": "2026-10-21T15:00:00.000Z",
    "companyId": "company:example",
    "direction": "outbound"
  }
}
```

Invariants:
- Stores kind outreach and direction outbound. Omitted direction and explicit outbound both store outbound. Any other direction is INVALID_COMMAND and writes nothing.
- --dry-run validates the envelope and returns the would-be result (status dry_run) without lock, write, audit, or ledger change.

## Contact clocks

Contact clocks are derived from stored interactions. Direction may be stored only on the closed contact-kind set: `outreach`, `outreach_sent`, `outreach_response`, `human_response`, `conversation`, `interview`, and `screen`. Historical rows are not rewritten to add direction.

For a confirmed contact-kind interaction with a real `occurred_at`, explicit `outbound` or `inbound` selects that clock, and explicit direction wins over kind. With no direction, kind `outreach` or `outreach_sent` selects outbound as a kind match. Every other undirected contact kind stays unknown, including `conversation` and `interview`. Direction on `note`, `application_outcome`, `opportunity_decision`, `strategy_gate_decision`, and every other non-contact kind is rejected. Those kinds never enter either clock.

`outreach record-sent` stores kind `outreach` and direction `outbound`. A contradictory caller direction is rejected and writes nothing. `interaction record` may set payload `direction` only with an eligible contact kind. For `application-attempt record-submission`: A supplied direction is INVALID_COMMAND. This command does not set direction and does not feed contact clocks.

Completion is an event match or internal evidence. Direction and a clock-usable time are clock classification, not completion evidence. A confirmed conversation or interview completes an action whose expected kind is that kind, including when direction and a clock-usable `occurred_at` are absent.

## Torn multi-file reads

Lock-free reads, including `model upgrade-preview`, `action list`, `action get`, `pipeline status`, and `readiness`, can observe a torn multi-file read while a locked mutation writes files one at a time. A torn read is not a successful upgrade and is not a reason to create `actions.json`.

