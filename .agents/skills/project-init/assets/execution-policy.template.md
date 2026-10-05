# Execution policy

Governs multi-agent, multi-harness, and tiered-model work in this project. Replace each `<binding: …>` with a project fact before adopting. A binding the project has not decided stays marked `unresolved`, and the rule that depends on it stays inactive.

## Principles

1. **Separation of powers:** The implementer never reviews their own work.
2. **Reviewer independence:** The reviewer operates in an independent harness, never as a subagent of the implementer.
3. **Escalation on evidence:** Raising a tier cites a concrete reproducible failure; lowering one cites measured completion rates.
4. **No silent substitution:** The executed model and harness are declared in every delivery record.
5. **Deterministic work uses no model:** A script, compiler, or test gate decides faster, reliably, and at zero token cost.

## Roles

| Role | Core function | Produces | Prohibited from |
|---|---|---|---|
| `oracle` | Deterministic verification | Pass/fail verdict | Exercising open subjective judgment |
| `scout` | Context reading, code inventory | Facts with `file:line` | Proposing architecture or broad redesigns |
| `driver` | Implements specifications | Diff + unit/regression tests | Deciding open architectural ambiguities |
| `reviewer` | Independent adversarial audit | Concrete, reproducible defects | Modifying source code directly |
| `arbiter` | Resolves disputes, decides open design | Authoritative recorded decision | Implementing production code |

**Hard rule:** `driver` and `reviewer` MUST NOT share the same harness or subagent lineage for the same delivery. Shared lineage breeds correlated errors: an implementer reviewing their own work repeats the blind spot that caused the defect, and child subagents inherit their parent's premises.

## Tiers

| Tier | Name | Work nature | Primary focus |
|---|---|---|---|
| **T0** | `deterministic` | Native builds, test suites, linters, formatters, hashes, metrics | Zero LLM usage. Local scripts and compiler commands. |
| **T1** | `mechanical` | Inventory, grep/search, context extraction, edits under exact spec | Fast, cost-efficient models with high context efficiency. |
| **T2** | `standard` | Implementation from spec, test writing, standard refactoring | High-discipline coding models. Daily engineering workhorse. |
| **T3** | `judgment` | Open architecture, ambiguous tradeoffs, cross-cutting invariants | Frontier reasoning models. Critique before code. |

**Tier-to-model mapping:** `<binding: tier → exact provider model identifier>`

## Operational rules

1. **Exclusive resource ownership:** Only one active writer per shared resource. `<binding: assigned working trees, ports, build locks, test service instances>`
2. **Authority of the gate:** No role declares green without deterministic verification. `<binding: exact test, lint, and build commands>`
3. **Declared harness roster:** `<binding: active harnesses and the canonical driver/reviewer pairing>`
4. **Bounded attempts:** Declare the maximum retry attempts upfront. Repeated failure without a new hypothesis stops the work and escalates to `arbiter`.
5. **Surface-separated evidence:** A local sandbox pass does not prove behavior in staging or release environments.

## Delivery declaration

Every commit, pull request, or task handoff carries:

```yaml
stream:     <work identifier>
item:       <task number or name>
role:       scout | driver | reviewer | arbiter | oracle
harness:    <which harness executed this task>
tier:       T0 | T1 | T2 | T3
model:      <exact provider model identifier>
escalation: no | <concrete defect motivating tier escalation>
gates:      <verdict of each T0 gate command>
```
