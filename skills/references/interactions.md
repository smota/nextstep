# Interactions and outreach

Use `interaction record --input -` only for an event the user wants preserved.

Prefer `opportunity record-decision --input -` for a confirmed pursue, calibrate, not-pursued, closed, or ineligible decision related to a Opportunity or ApplicationAttempt. It does not create an ApplicationAttempt. A user-directed exception preserves the original GO/CALIBRATE FIRST/STOP recommendation and requires a rationale.

Prefer `outreach record-sent --input -` for confirmed outreach so the caller supplies semantic fields rather than assembling a complete Interaction. It preserves the same channel, recipient, objective, date, and exact-message requirements as `interaction record`.

- Confirmed events require `occurred_at`.
- Confirmed outreach requires payload `channel`, `recipient`, and `objective`.
- Pass `messageArtifactId` only when it identifies the exact sent content; the CLI freezes its bytes.
- A draft or ready message is not a confirmed event.
- Networking may relate to Person, Company, or Opportunity without an ApplicationAttempt.
- When the event executes a selected strategy, pass `strategyIds`. For an experiment, also pass `experimentId` and `cohortId`.
- A `strategy_gate_decision` must be confirmed and contain `gate_decision.decision` (`pass`, `mitigate`, or `stop`), `checked_at`, `unresolved_gap_count`, and `evidence_or_mitigation`. Relate it to the relevant ApplicationAttempt or Opportunity and attribute it to the Strategy.
- Never infer recipients, channels, dates, responses, introductions, or outcomes.
