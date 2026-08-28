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
| `artifact register` | complete artifact `record` pointing to an existing vault file |
| `artifact adopt` | `artifactId`, `authorship`; optionally `expectedSha256` |
| `interaction record` | interaction `record`; confirmed outreach also requires `channel`, `recipient`, `objective`, and may include `messageArtifactId` |
| `application record-submission` | `applicationId`, `channel`, `occurredAt`, and explicit `artifactIds` |

Confirmed outreach and submissions freeze the exact supplied artifact bytes. Nextstep generates transmission metadata; callers do not construct snapshot paths or hashes.

## Concurrency

Read-only commands never lock. Mutations do not wait on other tasks: a short conflicting commit returns `COMMIT_BUSY`, allowing the caller to retry. Locks and transaction recovery are internal runtime details.

## Documents

`artifact status` detects direct edits. `artifact adopt` records a new user, AI, or mixed revision and snapshots its exact bytes. Structural checks reject empty or malformed DOCX/PDF containers. Visual rendering is not part of the default command path.

## Context budgets

`context build` accepts the stable intents `analyze`, `outreach`, `drafting`, `application`, and `interview`. `small` and `standard` return deliberately bounded excerpts; use `deep` only when the task genuinely needs broader evidence. Holoself is queried with `--self-only`, while vacancy, company, person, application, and artifact context is selected relationally by Nextstep.

Commands and options are strict. Unknown positionals and misspelled options return `USAGE` rather than being interpreted or ignored.
