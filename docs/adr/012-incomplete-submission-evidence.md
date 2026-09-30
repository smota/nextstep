# ADR 012: incomplete submission evidence and retrospective reports

Status: accepted for implementation by the approved adaptive-applicant-guidance plan.

## Decision

Submission bundle version 4 distinguishes unknown time and channel from known values, retains the original report, and appends reconciliation evidence on one stable Interaction. Receipt time is never substituted for occurrence time. Existing valid dated command inputs remain supported, and historical bundle versions 2/3 remain readable. No private history is automatically migrated.

A confirmed undated event is visible in overall counts but has no inferred age or date cohort. Reconciliation only fills unknowns; overwriting a known fact requires a separately designed correction operation. Revised working files require an explicit historical artifact digest when reconciling transmitted evidence. Snapshots are checked before use.

One ApplicationAttempt represents one submission event. Repeated reports reconcile that event; reapplication uses a new attempt. Late reports do not regress an interview/closed lifecycle to applied.

## Retrospective reporting

Standard recording retains strategy gates. Explicit retrospective reporting requires a source for an event that already happened and records unmet gate deviations. It never grants permission to submit or changes pre-action readiness. Current strategy attribution validation still applies; unknown or invalid attribution must not be manufactured.

## Rollback

Readers understand new evidence before writers are used. Once version 4 evidence exists, stop new writes or fix forward on a compatible reader; do not downgrade to a reader that rejects the evidence or flatten unknowns. Preserve original reports, snapshots, audit history, and any private backups. No destructive migration is part of this change.
