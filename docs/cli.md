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
