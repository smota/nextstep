---
name: nxt-context
description: Diagnose Nextstep, discover its installed contracts, resolve a linked instance, or build bounded read-only career context. Use for general Nextstep health and context requests; application packages and application lifecycle events belong to nxt-application.
---

# Nextstep context

Use the external agent for reasoning and drafting. Use the `nextstep` CLI only to discover its current contract, diagnose integration, or retrieve the smallest governed context needed for the request.

Remain read-only unless the user explicitly moves into an authorized workflow owned by a more specific Nextstep skill. Analysis, validation, readiness, and a generated draft do not imply a durable mutation or an external event.

## Route the request

- For executable, skill, PATH, marker, host, or Holoself health, read [integration and diagnosis](../references/integration.md) and [discovery and health](../references/discovery-and-health.md).
- For bounded evidence, read [context](../references/context.md).
- For readiness or compact product views without an ApplicationAttempt subject, read [workflow support](../references/workflow-support.md).
- For model integrity, read [validation](../references/validation.md).

Use `nextstep capabilities --json` and `nextstep command describe --command "<name>" --json` when the installed contract is unknown. CLI output is authoritative over this prose.

When integration diagnosis needs `--profile-root` and it was not supplied or exposed by the environment, ask for it. Do not guess a personal path. Report the selected data-root origin, missing evidence, truncation, and degraded dependencies explicitly.

Never read or mutate canonical Holoself storage directly. If its CLI is unavailable, limit the answer to evidence already authorized and available.

If the request develops into an authorized ApplicationAttempt package, artifact, submission, or outcome operation, follow `nxt-application` for that boundary. Do not persist silently and do not reject an already authorized package request merely because the conversation began read-only.
