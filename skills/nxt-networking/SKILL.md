---
name: nxt-networking
description: Work with Nextstep people, relationships, conversations, outreach drafts, and confirmed outreach events. Use for networking or contact work whether or not an ApplicationAttempt exists.
---

# Nextstep networking

Use the external agent to reason, draft, and collaborate. Use the `nextstep` CLI for governed context and every durable person or interaction record.

A person, conversation, or outreach draft does not require an ApplicationAttempt. A draft or planned message is not evidence that outreach was sent. Record an outreach event only when channel, recipient, objective, and occurrence are confirmed.

## Work from the current contract

- Read [context](../references/context.md) with intent `outreach` and a small or standard budget.
- Read [entities](../references/entities.md) when a Person or Company record is missing or needs an authorized update.
- Read [interactions](../references/interactions.md) for conversation and outreach evidence boundaries.
- Read [artifacts](../references/artifacts.md) for registered message drafts and direct user revisions.
- Read [validation](../references/validation.md) after a mutation.

Discover exact payloads with `nextstep command describe --command "<name>" --json`. Use `outreach record-sent` only for a confirmed sent event. Use `interaction record` for other confirmed interactions without bypassing their provenance. Never infer a channel, recipient, time, message body, ApplicationAttempt, strategy, or outcome.

If the request concerns application artifacts, submission, or outcome, follow `nxt-application`. If it concerns an opportunity decision rather than a relationship, follow `nxt-opportunity`.
