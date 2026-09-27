# CLI contract

`nextstep` is designed for humans and any local agent environment. Commands use JSON stdout and JSON stderr. They do not depend on Codex-specific thread state.

## Root resolution

Precedence is `--data-root`, `NEXTSTEP_DATA_ROOT`, the nearest ancestral `nextstep.yaml`, then upward layout discovery. The selected root must contain `Master/` and `Candidatures/records/`. An invalid nearest marker fails closed and does not fall back to another vault.

## Holoself root

Nextstep runs the external `holoself` CLI with `--project` set to the data root. To point Holoself at a specific data home, set `NEXTSTEP_HOLOSELF_HOME` in the environment; Nextstep passes it to Holoself as `HOLOSELF_HOME` and `doctor` reports whether it exists. The value is never committed and Nextstep never reads Holoself files itself.

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
| `interaction record` | interaction `record`; confirmed outreach also requires `channel`, `recipient`, `objective`, and may include `messageArtifactId` |
| `opportunity record-decision` | Opportunity/ApplicationAttempt `subjectId`, `decision`, `decidedAt`, and `reasonCodes`; a user-directed exception also requires the original recommendation and rationale |
| `outreach record-sent` | `channel`, `recipient`, `objective`, `occurredAt`, a relational subject, and optionally `messageArtifactId` |
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
nextstep workflow templates [--category <category>] --json
nextstep workflow template --id <workflow-template:id> --json
nextstep readiness --intent analyze|outreach|package|submit|close --subject <typed-id> --json
nextstep application-attempt submission-plan --id <application-attempt:id> --json
```

`command describe` returns the command mode, options or mutation envelope, payload schema, invariants, and stable error taxonomy. It is the authoritative agent discovery path; callers should not inspect source code or tests to reconstruct payloads.

Workflow templates normalize opportunity evidence, one-screen decisions, application-attempt packages and channels, recruiter scans, submission confirmations, outcome closures, and structural contracts for executive CVs, application-attempt letters, form answers, and executive outreach. ApplicationAttempt and drafting context packets embed their relevant contracts, so correctness does not depend on a separately installed skill or extra lookup. They never generate prose.

`readiness` reports current revision, embedded workflow contracts, existing artifacts, required input, active gates, unresolved evidence, and the smallest relevant validation scope. `application-attempt submission-plan` reports every attempt-owned artifact, clean/final eligibility, QA state, visual readiness, prior transmission, ambiguous roles, and cold-apply gate state.

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

## Privacy-safe run metrics

```text
nextstep run record --input -
nextstep run list [--limit <1-100>] --json
```

Run manifests live under disposable `.nextstep/runs/`. They may contain timing, tool family, command/error code, retries, cache hits, source/context digests, validation scope, and QA status. Unknown fields are rejected, and names associated with prompts, responses, content, messages, credentials, secrets, or tokens fail closed.

## Context budgets

`context build` accepts the stable intents `analyze`, `outreach`, `drafting`, `application`, and `interview`. Every packet embeds the applicable workflow contracts and authorization boundary. `small` and `standard` return deliberately bounded excerpts; use `deep` only when the task genuinely needs broader evidence. Holoself is queried with `--self-only`, while Opportunity, Company, Person, ApplicationAttempt, Artifact, and active subject-related Strategy context is selected relationally by Nextstep. Pass `--strategy <strategy:id>` for an explicit selection.

Commands and options are strict. Unknown positionals and misspelled options return `USAGE` rather than being interpreted or ignored.
