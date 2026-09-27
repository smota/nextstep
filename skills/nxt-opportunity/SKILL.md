---
name: nxt-opportunity
description: Analyze a Nextstep opportunity, normalize its evidence and gaps, assess readiness, or record an explicit pursuit decision. Use when a role or opportunity is in scope without requiring an ApplicationAttempt.
---

# Nextstep opportunity

Use the external agent for research and judgment. Use the `nextstep` CLI for bounded context and any explicitly requested durable decision.

Opportunity analysis is read-only. Do not create an ApplicationAttempt, package, interaction, or strategy merely because an opportunity is being evaluated. Missing evidence stays missing, and a recommendation is not a recorded user decision.

## Work from the current contract

- Read [context](../references/context.md) for the smallest useful evidence packet.
- Read [workflow support](../references/workflow-support.md) for opportunity evidence, decision briefs, and readiness.
- Read [interactions](../references/interactions.md) before recording an explicit opportunity decision.
- Read [validation](../references/validation.md) after a mutation.

Discover exact options with `nextstep command describe --command "<name>" --json`. Use `context build --intent analyze`, `readiness --intent analyze`, and `get` for read-only work. Use `opportunity record-decision` only when the user explicitly asks to record the decision; preserve its reason codes, source, and any user-directed exception from a STOP recommendation.

If the request advances to an authorized application package or an existing ApplicationAttempt, hand control to `nxt-application`. Do not silently cross that boundary.

For a view across every opportunity and attempt instead of this one, use `pipeline status` (see [workflow support](../references/workflow-support.md)) or route to `nxt-review`.
