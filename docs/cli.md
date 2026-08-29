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
| `interaction record` | interaction `record`; confirmed outreach also requires `channel`, `recipient`, `objective`, and may include `messageArtifactId` |
| `application record-submission` | `applicationId`, `channel`, `occurredAt`, and explicit `artifactIds` |

Confirmed outreach and submissions freeze the exact supplied artifact bytes. Nextstep generates transmission metadata; callers do not construct snapshot paths or hashes.

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

## Context budgets

`context build` accepts the stable intents `analyze`, `outreach`, `drafting`, `application`, and `interview`. `small` and `standard` return deliberately bounded excerpts; use `deep` only when the task genuinely needs broader evidence. Holoself is queried with `--self-only`, while vacancy, company, person, application, artifact, and active subject-related Strategy context is selected relationally by Nextstep. Pass `--strategy <strategy:id>` for an explicit selection.

Commands and options are strict. Unknown positionals and misspelled options return `USAGE` rather than being interpreted or ignored.
