---
name: nextstep
description: Use the local Nextstep CLI to retrieve career context, inspect or update governed records, adopt direct user edits, and record confirmed career events. Use for Nextstep and nextstep-sam work; do not use it as a mandatory workflow for ordinary conversation or drafting.
---

# Nextstep

Use the external agent environment for reasoning, research, drafting, and collaboration. Use `nextstep` only when bounded context or durable career state is needed.

## Choose the smallest capability

- For analysis or drafting only, remain read-only. Do not create records merely to satisfy a pipeline.
- For networking, a Person, Company, Vacancy, or Interaction may be recorded without an Application.
- For an application, create or update only the entities and artifacts the user actually needs.
- When the user edited a registered file directly, inspect `artifact status` and adopt it as a user revision; do not call it unknown or overwrite it.
- Record outreach or submission only after the user confirms the event. Confirmed outreach requires its date, channel, recipient, and objective; pass `messageArtifactId` when exact sent content is available. Never infer dates, recipients, channels, files sent, or outcomes.

## Route by task

Read the one relevant command reference before invoking that capability. A task may use more than one reference, but do not load unrelated command families.

| Intent | Reference | CLI family |
|---|---|---|
| Discover the contract or diagnose health | `references/discovery-and-health.md` | `capabilities`, `doctor` |
| Build bounded evidence | `references/context.md` | `context build` |
| Read or update relational subjects | `references/entities.md` | `get`, `entity upsert` |
| Select, guide, manage, or evaluate strategy | `references/strategies.md` | `strategy ...` |
| Manage measured comparisons | `references/experiments.md` | `experiment ...` |
| Inspect, register, or adopt files | `references/artifacts.md` | `artifact ...` |
| Record outreach or another event | `references/interactions.md` | `interaction record` |
| Record a confirmed submission | `references/applications.md` | `application record-submission` |
| Verify model or evidence integrity | `references/validation.md` | `validate` |

## Stable command boundary

Discover the current contract with `nextstep capabilities --json` and environment health with `nextstep doctor --json`. Build task-specific context with `nextstep context build` rather than scanning the complete vault.

Mutation commands take a versioned JSON envelope on stdin. Supply a stable request ID, idempotency key, actor, and expected revision when updating a versioned entity. Report structured errors to the user; do not acquire locks, edit record JSON, rebuild indexes, or append audit files yourself.

CLI capabilities, help, schemas, and structured strategy definitions are authoritative when skill prose and the installed executable differ. Stop and report the mismatch rather than guessing a command.

Holoself is an external global CLI consumed by Nextstep. Never edit canonical Holoself data through this skill; create a reviewable proposal when durable personal context should change.
