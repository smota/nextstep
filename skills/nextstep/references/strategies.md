# Strategies

Strategy definitions are immutable product playbooks. Private Strategy records activate one definition for a concrete objective, scope, parameters, and success criteria.

Read-only commands:

```text
nextstep strategy definitions [--category <category>] --json
nextstep strategy definition --id <strategy-definition:id> --json
nextstep strategy list [--status <status>] [--definition <id>] [--subject <typed-id>] --json
nextstep strategy get --id <strategy:id> --json
nextstep strategy guide --id <strategy:id> [--phase <phase>] [--subject <typed-id>] --json
nextstep strategy evaluate --id <strategy:id> --json
```

Mutations:

```text
nextstep strategy create --input -
nextstep strategy update --input -
nextstep strategy set-status --input -
```

- Strategy lifecycle is `draft -> active -> paused -> active|completed|abandoned`; a draft may also be abandoned. Terminal records do not reopen.
- Confirmed execution can be attributed only to an active Strategy.
- `update` requires `expectedRevision`; status changes use `set-status`.
- Closing requires a conclusion. Preserve the strategy and its evidence after closure.
- Run `guide` before executing an explicitly selected strategy. Instructions are deterministic; the external agent still performs reasoning and obtains any required authorization.
- Before a submission attributed to `cold-apply`, record a confirmed `strategy_gate_decision` Interaction for the ApplicationAttempt or Opportunity. A `stop` decision or configured unresolved-gap threshold breach blocks submission.
- `evaluate` counts only confirmed attributed events and never infers causality, silence, rejection, or recruiter intent.
- A strategy is optional unless the user or task explicitly selected one. Do not force ordinary research, drafting, or networking into a strategy.

Synthetic create payload:

```json
{"schemaVersion":1,"requestId":"strategy-create-1","idempotencyKey":"strategy-create-1","actor":"agent","payload":{"record":{"id":"strategy:acme-cold-apply","definition_id":"strategy-definition:cold-apply","objective":"Test selected Acme opportunities","scope":{"subject_ids":["opportunity:acme-lead"]},"parameters":{"follow_up_after_days":14},"success_criteria":[{"metric":"human_response","operator":">=","value":1}]}}}
```
