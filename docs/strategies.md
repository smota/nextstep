# Strategies and experiments

Nextstep separates reusable job-search knowledge from private execution data.

## Model

- **StrategyDefinition** is immutable, versioned product data in `catalog/strategy-definitions.json`. It defines purpose, applicability, phased instructions, completion evidence, metrics, and guardrails.
- **Strategy** is a private record that activates one definition for an objective, scope, parameters, and success criteria.
- **Experiment** is a private record that compares named cohorts associated with one or more Strategies.

Schemas are published under `schemas/`. Runtime validation additionally verifies typed references, known definition IDs, lifecycle values, cohort attribution, and optimistic revisions.

## Built-in definitions

| ID suffix | Purpose |
|---|---|
| `cold-apply` | Targeted direct application to a known vacancy. |
| `warm-introduction` | Approach through an existing trusted relationship. |
| `hiring-leader-outreach` | Seek substantive calibration with a mandate owner. |
| `executive-search-market-mapping` | Build durable relationships with relevant executive-search consultants. |
| `target-company-campaign` | Develop selected organizations independently of a single advertised role. |
| `internal-mobility` | Explore and pursue mandates through appropriate internal channels. |
| `authority-building` | Build credible visibility through useful public expertise. |
| `community-event-networking` | Build relationships through relevant communities and events. |

The catalog is not a promise that a tactic will work. Definitions state instructions and evidence boundaries; private Strategy records decide whether, where, and how a tactic applies. Definition `source_refs` resolve to the catalog's structured source list so established-practice provenance remains inspectable.

## Lifecycle

Strategy lifecycle:

```text
draft -> active -> paused -> active
  |        |         |----> completed
  |        |--------------> completed
  |-----------------------> abandoned
```

Experiment lifecycle substitutes `running` for `active`. Terminal records do not reopen. Closing either record requires a conclusion and preserves its evidence.

Content changes and lifecycle changes are separate mutations. Both require the current `source_revision`; idempotency protects exact retries.

## Process integration

Strategies are composable and optional:

1. Discover definitions with `strategy definitions` or inspect one with `strategy definition`.
2. Create a private Strategy only when a durable objective, scope, or measurement plan is useful.
3. Use `strategy guide` before executing an explicitly selected Strategy.
4. For `cold-apply`, record a confirmed `strategy_gate_decision` Interaction for the Application or Vacancy before submission. The decision contains `pass`, `mitigate`, or `stop`, its check date, unresolved-gap count, and evidence or mitigation. A configured maximum is enforced.
5. Attribute confirmed Interactions or submissions only to active Strategies with `strategyIds`; include a running `experimentId` and valid `cohortId` only when they genuinely belong to an Experiment.
6. Use `strategy evaluate` or `experiment evaluate` for confirmed-event-only observations.

`context build --strategy <strategy:id>` explicitly includes one Strategy. Without that option, context includes only active Strategies related to the selected subject. With no selected or related Strategy, the packet contains an empty Strategy selection and ordinary work continues.

Evaluation never treats drafts as events, silence as rejection, or correlation as causation. User-reviewed interpretation belongs in the terminal conclusion, not in computed metrics.

## Migration

Six-collection vaults must run `strategy initialize` through the normal mutation envelope. It atomically creates empty `strategies.json` and `experiments.json`, updates the manifest and indexes, and records audit/idempotency evidence. Read-only commands and `doctor` never initialize state.

Legacy strategy documents should be preserved as provenance until their structured records are reviewed and validated. Identity, private evidence, submitted artifacts, and personal geography remain private data; they do not move into the public definition catalog.
