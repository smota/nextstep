---
name: nxt-review
description: Review the governed Nextstep search state, compare next steps, and inspect or manage explicitly selected strategies and experiments. Use for portfolio reviews and learning loops, not for a single application package.
---

# Nextstep review

Use the external agent to synthesize the search and propose decisions. Use the `nextstep` CLI to read governed state and to persist only an explicitly requested Strategy or Experiment change.

Review is read-only by default. A strategy or experiment is optional: do not create, select, activate, attribute, pause, or close one merely because it could be useful. Keep confirmed events separate from interpretation and recommendations.

Before guiding or refining an applicant's work, read [adaptive guidance](../references/guidance.md) for optional questions, scope, and review.

## Work from the current contract

- Read [context](../references/context.md) for bounded evidence.
- Read [strategies](../references/strategies.md) for definitions, selection, guides, gates, lifecycle, and evaluation.
- Read [experiments](../references/experiments.md) for hypotheses, cohorts, measurement, and lifecycle.
- Read [workflow support](../references/workflow-support.md) for compact decision views.
- Read [validation](../references/validation.md) after a mutation.

Discover current shapes with `nextstep command describe --command "<name>" --json`. Prefer `strategy definitions/list/get/guide/evaluate` and `experiment list/get/evaluate` for read-only review. Create or update records only on an explicit request, use current revisions, and report sparse or confounded evidence rather than inventing causality.

Route a single opportunity to `nxt-opportunity`, relationship work to `nxt-networking`, and application package or lifecycle work to `nxt-application`.
