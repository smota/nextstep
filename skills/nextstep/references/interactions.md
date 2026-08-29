# Interactions and outreach

Use `interaction record --input -` only for an event the user wants preserved.

- Confirmed events require `occurred_at`.
- Confirmed outreach requires payload `channel`, `recipient`, and `objective`.
- Pass `messageArtifactId` only when it identifies the exact sent content; the CLI freezes its bytes.
- A draft or ready message is not a confirmed event.
- Networking may relate to Person, Company, or Vacancy without an Application.
- When the event executes a selected strategy, pass `strategyIds`. For an experiment, also pass `experimentId` and `cohortId`.
- A `strategy_gate_decision` must be confirmed and contain `gate_decision.decision` (`pass`, `mitigate`, or `stop`), `checked_at`, `unresolved_gap_count`, and `evidence_or_mitigation`. Relate it to the relevant Application or Vacancy and attribute it to the Strategy.
- Never infer recipients, channels, dates, responses, introductions, or outcomes.
