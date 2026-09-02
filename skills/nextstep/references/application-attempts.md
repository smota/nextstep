# Application attempts and submissions

Use `application-attempt record-submission --input -` only after submission is confirmed. Payload requires `applicationAttemptId`, `channel`, exactly one of `occurredAt` or date-only `occurredOn`, and `artifactSelection`. Never manufacture a time for a date-only confirmation.

`artifactSelection.state` is `unknown` when the user has not confirmed which files were transmitted, `confirmed_none` when the user confirms no files were transmitted, or `confirmed` with a non-empty `artifactIds` array. These states are not interchangeable.

ApplicationAttempt and drafting context packets include the applicable workflow contracts. Capture the real form and artifact requirements before generating channel-specific artifacts. A direct package request authorizes in-scope drafting, rendition creation, registration, and quality checks; do not request a redundant approval.

Use `application-attempt register-package --input -` to atomically create missing Company/Opportunity/ApplicationAttempt records and register externally authored contained files. It never generates content and never updates existing entities. An invalid record or file leaves no partial package.

Use `application-attempt submission-plan --id <application-attempt:id>` before asking for confirmation. It reports clean final candidates, QA and visual state, previous transmission, ambiguous roles, active cold-apply gates, and exact confirmation fields. Never call submission with guessed artifact IDs.

Retrieve the ApplicationAttempt and inspect artifact status first. Pass its current revision as `expectedRevision`. Do not infer which CV, letter, answers, or attachments were transmitted.

The CLI freezes exact selected clean bytes, creates the confirmed submission Interaction with explicit temporal precision, and advances the ApplicationAttempt. A file with an unadopted revision is rejected rather than silently adopted. When executing a strategy or experiment, pass `strategyIds` and optionally `experimentId` plus `cohortId`; the attribution is recorded on the submission and ApplicationAttempt.

If a submission was recorded with `artifactSelection.state: unknown` and the user later confirms the files, use `application-attempt reconcile-submission --input -` with the submission ID, its current revision, and a confirmed selection. Never use generic entity upsert to rewrite submission evidence.

Afterward, validate `application-attempt:<id>` and report unresolved evidence such as an empty artifact selection.

Use `application-attempt close --input -` for rejected, withdrawn, or closed outcomes. Supply the current revision, exact outcome and reason, and optional stage. Supply `occurredAt` only when known; without it Nextstep records that the outcome date is unresolved and does not create a dated outcome Interaction.
