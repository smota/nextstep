# ADR 011: scoped guidance briefs as artifacts

Status: accepted for implementation by the approved adaptive-applicant-guidance plan.

## Decision and scope check

Caller-supplied answers are sufficient within one interaction. Restart/cross-client suppression needs durable, typed answer semantics, safe revisions, and source/dependency references. Existing free-form notes do not provide those semantics. Reuse Artifact storage with a `guidance_brief` JSON payload and one bounded semantic mutation; retain the eight existing collections.

Briefs store selected answers, preferences, hypotheses, and decisions with explicit subject or shared scope. The command creates no related entity. Shared campaign briefs require explicit inclusion. Entity briefs are retrieved only for the subject's ownership ancestry. A narrower preference can override a broader one; conflicting facts remain visible. A superseding answer preserves the prior answer and immutable brief snapshots.

## Consequences

No conversation database or transcript persistence is introduced. Brief writes use existing transactions, optimistic revisions, idempotency, and snapshots. User-edited brief drift must be adopted or reconciled before reuse. Stable identity/voice remains in Holoself; a private brief carries scoped choices rather than another personal source of truth. Read-only guidance never persists answers merely because they were supplied.
