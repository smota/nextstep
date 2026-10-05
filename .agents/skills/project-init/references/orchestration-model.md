# Multi-harness and multi-model execution: planning reference

Read when the intake selects multi-harness governance or tiered models. This file decides whether to adopt the model and how to bind it. The policy the target receives is [execution-policy.template.md](../assets/execution-policy.template.md), which also defines the principles, roles, tiers, and delivery declaration.

## Adoption gate

The model carries real coordination overhead. It pays for itself only when at least one condition holds:

- **Irreversible decisions:** Published data formats, external API contracts, database schemas, or wire protocols.
- **Cross-session continuity:** Work spans multiple sessions and context must outlive individual executor lifecycles.
- **Verification exceeds test suites:** Correctness invariants cannot be fully captured by tests alone (concurrency, process semantics, cross-platform portability).
- **Evidence-heavy verification:** Empirical measurements must be independently audited to confirm they are not right for the wrong reasons.

When none applies (single-file scripts, disposable prototypes, routine mechanical refactors), keep the baseline lightweight and skip the policy.

## Cost lever hierarchy

Routing by model tier is the **second** cost lever, not the first. Two properties govern LLM cost:

1. **Prompt caches are model-scoped:** Cascading between model families forfeits cache reuse. Rereading large repository context across tiers can exceed the token price difference.
2. **Unit of cost is the completed task, not the request:** A cheap model that needs three iterations or produces diffs the reviewer rejects costs more than a capable model that succeeds first time.

| Priority | Lever | Prerequisite before advancing |
|---|---|---|
| 1 | Eliminate models (T0) | Convert every deterministic check into a runnable command. |
| 2 | Context hygiene | Feed the agent bounded, relevant slices rather than whole trees. |
| 3 | Effort level tuning | Verify that lower reasoning/thinking effort retains quality. |
| 4 | Tier substitution | Measure that the cheaper tier reliably completes the task. |
| 5 | Cross-harness | Adopt only when purchasing true reviewer independence. |

*Corollary:* Before introducing a model cascade, test the primary model at lower effort. Single-model caching is frequently cheaper per completed task.

## Execution modes

### Mode A: cross-harness

- **Mechanism:** Separate contexts, distinct agent harnesses, independent model families.
- **Value:** True independence. The reviewer inherits neither context windows, prompt instructions, nor vendor blind spots. Spreads quota across distinct provider pools.
- **Cost:** High coordination overhead. Nothing is implicit; context transfer must be fully documented.
- **Use when:** The primary failure mode is **correlated error**.

### Mode B: single-harness cross-model

- **Mechanism:** Subagents across different tiers within one harness; shared memory or task dispatch.
- **Value:** Token economy. Fan-out context reads in T1, synthesis in T2/T3.
- **Cost:** Shared context windows risk shared blind spots; inter-tier transitions lose prompt cache reuse.
- **Use when:** The primary failure mode is **token cost**, not verification bias.

> **Cross-harness when you require independence. Cross-model when you require economy.**
>
> Cross-harness earns its overhead only through independence, and shared-context subagents give economy without independence, so critical verification stays cross-harness.

*Composition:* Use Mode B inside each harness for mechanical reading, and Mode A between the `driver` and the `reviewer`.

## Allocation principles

**High-tier models (T3) touch only work where errors are both costly AND difficult to detect.**

A published contract qualifies: errors survive peer review and fix costs compound with downstream adoption. Complex implementations thoroughly covered by tests do not qualify: bugs trigger deterministic gates immediately.

*Consequence:* High-risk but immediately detectable code warrants lower tiers than lower-risk but silent, invisible invariants.

- **T3 before code:** For any contract (schema, API protocol, wire format), draft, challenge, and lock the specification in prose before authoring code. Changing prose costs zero; changing implemented code fights sunk-cost bias.
- **Convert T2 to T0:** When an invariant can be asserted deterministically ("outputs are byte-identical", "both implementations agree"), write that test. Paying a model once to create a T0 test permanently removes models from that verification path.

## Binding the policy

Resolve four bindings before writing the policy into the target:

1. **Tier-to-model mapping:** Map available models to tiers using [model-catalog.md](model-catalog.md). Take rates and API identifiers from the provider's own pages when setting budgets.
2. **Resource ownership:** Record assigned working trees, ports, build locks, and test service instances.
3. **Gate commands:** Record the exact test, lint, and build commands that hold final authority.
4. **Harness roster:** Record the active harnesses and the canonical `driver`/`reviewer` pairing; take commands and parameter rules from [harness-parameters.md](harness-parameters.md).

A binding the user has not decided goes into the initialization record as `unresolved`, and the policy marks it the same way.

## Honesty about operational state

Until a project tracks **cost per completed task by tier against reviewer acceptance rate**, tier allocations remain declared hypotheses. A tier that looks cheap per token is the most expensive in practice when its diffs are repeatedly rejected in independent review.
