# Backlog: Opportunity structured fields — location, work_model, pay (Kyle precondition D-054)

Created 2026-10-05. Approval ref: D-054.

## Goal

Add first-class structured fields on Opportunity so Kyle (job monitor) and Next Step can filter/score without parsing free-text JD markdown.

## Context

D-054: CreateAgent for Kyle blocked until (1) vault backfill of missing JD/URL and (2) these product fields exist. Samuel approved emitting this request on 2026-10-05. Plan: grok-bot/work/admin-2026-10-05/kyle-backfill-plan.md

## Acceptance Criteria

- [ ] Opportunity schema/API/CLI exposes: location (country codes + optional city + raw), work_model (onsite|hybrid|remote|unknown), pay (currency, min, max, period, ote flag, or unknown).
- [ ] Existing opportunities remain valid with null/unknown defaults; no destructive migration.
- [ ] nextstep doctor / record write paths accept and persist the new fields.
- [ ] Index/markdown rendering shows the three fields when set.
- [ ] Short docs note: values may be filled by humans or later by Kyle/import; paraphrase JDs must not auto-invent pay/location.

## Constraints

- Out of scope: Kyle CreateAgent, application package G0–G6, LinkedIn scraping, backfill of the 71/50 vault data gaps (Phase A is vault ops).
