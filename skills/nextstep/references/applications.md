# Applications and submissions

Use `application record-submission --input -` only after submission is confirmed. Payload requires `applicationId`, `channel`, `occurredAt`, and an explicit `artifactIds` array, which may be empty only when no transmitted artifact is asserted.

Before drafting, use the `workflow-template:application-channel-manifest` view outside the CLI to capture the real form and artifact requirements. Drafting remains external.

Use `application register-package --input -` to atomically create missing Company/Vacancy/Application records and register externally authored contained files. It never generates content and never updates existing entities. An invalid record or file leaves no partial package.

Use `application submission-plan --id <application:id>` before asking for confirmation. It reports clean final candidates, QA and visual state, previous transmission, ambiguous roles, active cold-apply gates, and exact confirmation fields. Never call submission with guessed artifact IDs.

Retrieve the Application and inspect artifact status first. Pass its current revision as `expectedRevision`. Do not infer which CV, letter, answers, or attachments were transmitted.

The CLI freezes exact selected bytes, creates the confirmed submission Interaction, and advances the Application. When executing a strategy or experiment, pass `strategyIds` and optionally `experimentId` plus `cohortId`; the attribution is recorded on the submission and Application.

Afterward, validate `application:<id>` and report unresolved evidence such as an empty artifact selection.

Use `application close --input -` for rejected, withdrawn, or archived outcomes. Supply the current revision, exact outcome and reason, and optional stage. Supply `occurredAt` only when known; without it Nextstep records that the outcome date is unresolved and does not create a dated outcome Interaction.
