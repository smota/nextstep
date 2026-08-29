# CLI contract

`nextstep` is designed for humans and any local agent environment. Commands use JSON stdout and JSON stderr. They do not depend on Codex-specific thread state.

## Root resolution

Precedence is `--data-root`, `NEXTSTEP_DATA_ROOT`, then upward discovery from the current directory. The selected root must contain `Master/` and `Candidatures/records/`.

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
| `strategy initialize` | empty payload; explicit six-collection to eight-collection migration |
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
| `opportunity record-decision` | Vacancy/Application `subjectId`, `decision`, `decidedAt`, and `reasonCodes`; a user-directed exception also requires the original recommendation and rationale |
| `outreach record-sent` | `channel`, `recipient`, `objective`, `occurredAt`, a relational subject, and optionally `messageArtifactId` |
| `application register-package` | optional new Company/Vacancy/Application `records` plus existing contained artifact files; at least one record or artifact is required |
| `application record-submission` | `applicationId`, `channel`, `occurredAt`, and explicit `artifactIds` |
| `application close` | `applicationId`, terminal lifecycle, `outcome`, `reason`, and envelope `expectedRevision`; an outcome date is optional and never inferred |
| `run record` | privacy-safe operational `run` manifest; writes only disposable runtime state |

Confirmed outreach and submissions freeze the exact supplied artifact bytes. Nextstep generates transmission metadata; callers do not construct snapshot paths or hashes.

`application register-package` does not draft. It atomically registers new relational records and externally authored files, creates immutable initial snapshots, and fails without partial state when any supplied record or file is invalid. Existing records must be omitted and managed through their dedicated commands.

An explicit empty submission artifact list is allowed when the user confirms the event but no transmitted file is asserted. The resulting submission records unresolved evidence instead of inventing a bundle.

## Discovery, readiness, and workflow views

These commands are read-only and do not authorize a mutation:

```text
nextstep command describe --command "<command name>" --json
nextstep workflow templates [--category <category>] --json
nextstep workflow template --id <workflow-template:id> --json
nextstep readiness --intent analyze|outreach|package|submit|close --subject <typed-id> --json
nextstep application submission-plan --id <application:id> --json
```

`command describe` returns the command mode, options or mutation envelope, payload schema, invariants, and stable error taxonomy. It is the authoritative agent discovery path; callers should not inspect source code or tests to reconstruct payloads.

Workflow templates normalize vacancy evidence, one-screen decisions, application-channel manifests, recruiter scans, submission confirmations, outcome closures, and structural contracts for executive CVs, application letters, form answers, and executive outreach. They are presentation contracts, not required documents, and they never generate prose.

`readiness` reports current revision, existing artifacts, required input, active gates, unresolved evidence, and the smallest relevant validation scope. `application submission-plan` reports every application-owned artifact, clean/final eligibility, QA state, visual readiness, prior transmission, ambiguous roles, and cold-apply gate state. The caller still supplies explicit artifact IDs to `application record-submission`.

Interactions and submissions accept optional payload `strategyIds`. Experiment attribution additionally requires both `experimentId` and a valid `cohortId`. Callers do not place these fields directly in an Interaction record.

Confirmed execution may be attributed only to an `active` Strategy and, when used, a `running` Experiment. Planned evidence may be prepared before activation but does not count in evaluation.

A submission attributed to `strategy-definition:cold-apply` requires a prior confirmed `strategy_gate_decision` Interaction related to its Application or Vacancy. Its `gate_decision` records `decision` (`pass`, `mitigate`, or `stop`), `checked_at`, `unresolved_gap_count`, and `evidence_or_mitigation`. `stop` blocks submission; `parameters.maximum_unresolved_hard_gaps` is enforced when configured.

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

`artifact record-qa` records evidence supplied by an external renderer. The manifest binds the canonical source SHA-256, derived artifact SHA-256, capability/template versions, and structural, accessibility, parity, and visual results. Nextstep computes `generated`, `structurally_verified`, or `visually_verified`; a later submission is exposed separately as `transmitted` by the submission plan.

## Privacy-safe run metrics

```text
nextstep run record --input -
nextstep run list [--limit <1-100>] --json
```

Run manifests live under disposable `.nextstep/runs/`. They may contain timing, tool family, command/error code, retries, cache hits, source/context digests, validation scope, and QA status. Unknown fields are rejected, and names associated with prompts, responses, content, messages, credentials, secrets, or tokens fail closed.

## Context budgets

`context build` accepts the stable intents `analyze`, `outreach`, `drafting`, `application`, and `interview`. `small` and `standard` return deliberately bounded excerpts; use `deep` only when the task genuinely needs broader evidence. Holoself is queried with `--self-only`, while vacancy, company, person, application, artifact, and active subject-related Strategy context is selected relationally by Nextstep. Pass `--strategy <strategy:id>` for an explicit selection.

Commands and options are strict. Unknown positionals and misspelled options return `USAGE` rather than being interpreted or ignored.
