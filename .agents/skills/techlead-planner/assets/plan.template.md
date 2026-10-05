# Plan: <goal in a few words>

## Goal and acceptance

<One paragraph restating the goal in the planner's own words.>

Acceptance criteria:

- <checkable criterion>

## Blocking questions

<0-3. Each with a recommended default. Write "None blocking" when there are none.>

1. <question> Default: <answer>

## Assumptions

<Numbered, specific, falsifiable. Mark a dimension "untouched" when the task does not reach it.>

1. **Data:** <assumption>
2. **Failure:** <assumption>
3. **Boundaries:** <assumption>
4. **State:** <assumption>
5. **Environment:** <assumption>
6. **Scope:** Not doing <x>; leaving <y> as TODO.
7. **Testing:** Tests for <x>; not covering <y>.

## Slices

| ID | Behavior delivered | Acceptance check | Test level | Size | Blast radius | Depends on |
|---|---|---|---|---|---|---|
| S1 | <observable behavior> | <how it is proven> | <unit / integration / e2e> | <S/M/L> | <what it can break> | none |

## Order and rationale

<The sequence, with a one-clause reason wherever dependency does not force the position: risk first, reversible before irreversible, expand before contract.>

## Placement

| Module | Layer | New imports (direction) | New boundary |
|---|---|---|---|
| <path> | <entity / use case / adapter / framework> | <inward or outward, to what> | <none, or full/partial with the volatility that justifies it> |

## NFR check

| Area | Applies? | Target or decision, or reason it does not apply |
|---|---|---|
| Security | <yes/no> | <...> |
| Privacy and compliance | <yes/no> | <...> |
| Performance and capacity | <yes/no> | <...> |
| Reliability | <yes/no> | <...> |
| Observability | <yes/no> | <...> |
| Operability | <yes/no> | <...> |
| Compatibility and versioning | <yes/no> | <...> |
| Cost | <yes/no> | <...> |
| Usability and accessibility | <yes/no> | <...> |
| Maintainability and testability | <yes/no> | <...> |
| Portability and environment | <yes/no> | <...> |

## Quality gates

- **Done, per slice:** <checks that can run>
- **Review points:** <what a reviewer looks at, and when>
- **Rollback:** <per irreversible step, or the explicit decision that none exists>
- **ADRs needed:** <decisions, or none>

## Goal conditions

<One per slice, under 4,000 characters (the `/goal` limit), usable as the completion condition of an autonomous run. The evaluator judges only what appears in the conversation, so each check must print its result.>

- **S1:** <one measurable end state>. Proven by `<check command>` exiting <code>, with its output shown. Constraints: <what must not change>. Stop and report if <assumption ID> fails, or after <N> turns.

## Stop conditions

<The assumptions whose failure sends the work back to the user, and the plan checks that must hold on first contact with the code.>

## Approval

Approve, or tell me what to change.
