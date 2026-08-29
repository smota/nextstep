# Applications and submissions

Use `application record-submission --input -` only after submission is confirmed. Payload requires `applicationId`, `channel`, `occurredAt`, and an explicit `artifactIds` array, which may be empty only when no transmitted artifact is asserted.

Retrieve the Application and inspect artifact status first. Pass its current revision as `expectedRevision`. Do not infer which CV, letter, answers, or attachments were transmitted.

The CLI freezes exact selected bytes, creates the confirmed submission Interaction, and advances the Application. When executing a strategy or experiment, pass `strategyIds` and optionally `experimentId` plus `cohortId`; the attribution is recorded on the submission and Application.

Afterward, validate `application:<id>` and report unresolved evidence such as an empty artifact selection.
