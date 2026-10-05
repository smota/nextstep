---
name: techlead-planner
description: "Turn a goal into a reviewed plan before any implementation: gate questions, vertical slices, ordering, architecture placement, and a non-functional pass."
category: software-engineering
disable-model-invocation: true
---

# TechLead planner

Act as the lead engineer on a plan before it closes: refine the breakdown, the order, and the quality bar, including the non-functional areas, and hand the user a plan to approve. A wrong assumption is the planner's cost to avoid, and an unnecessary question is the user's cost, so ask only what research cannot answer. This skill writes a plan and implements nothing.

## Inputs

A goal, or a draft plan to refine, plus any constraints. Take facts from the repository (code, tests, configs, dependency manifests, existing decisions) and label everything else an assumption.

## Prerequisites

- Read access to the target project.
- Optional: read-only commands (listing tests, querying dependencies) to gather evidence.

## Commands

| Command | Reads | Action | Output |
|---|---|---|---|
| `/techlead-planner <goal>` | [architecture-lens](references/architecture-lens.md), [nfr-checklist](references/nfr-checklist.md), [plan template](assets/plan.template.md) | Run the workflow on the goal | A plan in the template's shape, ending at the approval question |
| `/techlead-planner review [plan]` | the same | Run steps 1 and 3–8 on a plan in the conversation or at a path, and correct the plan where it falls short | Findings ordered by severity, then the revised plan sections |

**Failure:** without a goal or a plan, ask for one. For repository areas that cannot be read, label the evidence unavailable and plan around the gap with an assumption. An open blocking question stops the plan at step 2.

## Proportionality

Ceremony scales with blast radius. A typo, a rename, or a change of roughly 20 lines with one obvious correct form gets a one-paragraph plan: the change, the check that proves it, done. A new module, a schema change, or anything touching authentication, money, migrations, or deletion gets the full workflow, and its assumptions get more suspicion than usual.

## Workflow

1. **Investigate.** Read the relevant code, tests, configs, manifests, and prior decisions. Anything found within a minute of searching is research, and a codebase that contradicts itself is worth raising. **Complete when:** every fact the plan relies on cites a path or is listed as an assumption.
2. **Frame.** Restate the goal in your own words with the acceptance criteria you will hold the plan to. Ask 0–3 blocking questions, only where a wrong answer would discard work, each with a recommended default so the reply can be "yes to all". **Complete when:** the goal and criteria are written and every blocking question has a default. With any blocking question open, present the frame and stop.
3. **Assume.** Number the assumptions, each specific and falsifiable ("inputs stay under 10k rows and fit in memory"; "the code is maintainable" is not one). Cover the dimensions the task touches:
   - data: shape, volume, trust level, encoding, what malformed input looks like
   - failure: on timeout, partial write, or downstream 500, retry, fail loud, or degrade
   - boundaries: callers, public API versus internal, backwards compatibility
   - state: concurrency, idempotency, transactionality, ordering
   - environment: runtime version, where it deploys, what it may reach
   - scope: what is deliberately not done and left as TODO
   - testing: what gets tests and what stays uncovered

   **Complete when:** every dimension is covered or marked untouched.
4. **Break down.** Cut the work into vertical slices, each delivering observable behavior with its own acceptance check, test level, size (S, M, L), blast radius, and dependencies. **Complete when:** every slice has an acceptance check and none depends on a later slice.
5. **Order.** Sequence by dependency, then risk: run the riskiest unknown first as a spike or walking skeleton, put reversible changes ahead of irreversible ones, and stage contract or schema changes as expand, migrate, contract. Keep each slice mergeable on its own. **Complete when:** every placement not forced by a dependency has a one-clause rationale.
6. **Place.** For each new or changed module, name its layer, the direction of each new import, and any new boundary (full or partial) with the volatility that justifies it, using [architecture-lens](references/architecture-lens.md). **Complete when:** every new module has a layer and import directions, or the plan states there are none.
7. **Check non-functionals.** Walk [nfr-checklist](references/nfr-checklist.md). Each item is *applies* with a measurable target or a named decision, or *not applicable* with a reason. **Complete when:** no item is blank and no *applies* lacks a target or decision.
8. **Set the quality gates.** State done for each slice as checks that can run, name the review points, give a rollback for every irreversible step (or the decision that none exists), and list the decisions that need an ADR. Then write each slice's goal condition for an autonomous run: one measurable end state, the check that proves it (its output must appear in the conversation, since an evaluator judges only what is shown), the constraints, the assumptions that stop the run, and a turn limit. **Complete when:** every done condition is checkable, every irreversible step has a rollback or an explicit no-rollback decision, and every slice has a goal condition under 4,000 characters.
9. **Present and stop.** Write the plan in the template's shape, list the assumptions whose failure sends the work back to the user, and end by asking for approval or changes. **Complete when:** the plan is shown and nothing outside it has been created or changed.

## Credits

- The gate (goal restatement, blocking questions with defaults, falsifiable assumptions, proportionality) adapts a pre-implementation prompt supplied by the maintainer.
- The architecture lens condenses Robert C. Martin, *Clean Architecture*, and follows the structure of the `clean-architecture` skill's diagnostic. No dependency on either.
- The non-functional areas follow the quality characteristics of ISO/IEC 25010.
- The goal-condition shape (one measurable end state, a stated check, constraints, a turn limit) follows Claude Code's `/goal` guidance.
