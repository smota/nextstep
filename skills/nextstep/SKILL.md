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
| Discover the contract or diagnose health | `references/discovery-and-health.md` | `capabilities`, `command describe`, `doctor` |
| Build bounded evidence | `references/context.md` | `context build` |
| Check readiness or use compact workflow views | `references/workflow-support.md` | `workflow templates`, `workflow template`, `readiness`, `run list`, `run record` |
| Read or update relational subjects | `references/entities.md` | `get`, `entity upsert` |
| Select, guide, manage, or evaluate strategy | `references/strategies.md` | `strategy ...` |
| Manage measured comparisons | `references/experiments.md` | `experiment ...` |
| Inspect, register, adopt, or attach QA evidence | `references/artifacts.md` | `artifact status`, `artifact register`, `artifact adopt`, `artifact record-qa`, `artifact bootstrap-snapshots` |
| Record a decision, outreach, or another event | `references/interactions.md` | `opportunity record-decision`, `outreach record-sent`, `interaction record` |
| Register a package, plan/record submission, or close | `references/applications.md` | `application register-package`, `application submission-plan`, `application record-submission`, `application close` |
| Verify model or evidence integrity | `references/validation.md` | `validate` |

## Stable command boundary

Discover the current contract with `nextstep capabilities --json`, then use `nextstep command describe --command "<name>" --json` instead of reading source or tests. Check environment health with `nextstep doctor --json`. Build task-specific context with `nextstep context build` rather than scanning the complete vault.

Mutation commands take a versioned JSON envelope on stdin. Supply a stable request ID, idempotency key, actor, and expected revision when updating a versioned entity. Report structured errors to the user; do not acquire locks, edit record JSON, rebuild indexes, or append audit files yourself.

CLI capabilities, help, schemas, and structured strategy definitions are authoritative when skill prose and the installed executable differ. Stop and report the mismatch rather than guessing a command.

Holoself is an external global CLI consumed by Nextstep. Never edit canonical Holoself data through this skill; create a reviewable proposal when durable personal context should change.
