# Architecture decisions and workflow

## Lifecycle

Decision status:

```text
Draft -> Proposed -> Accepted
           |------> Rejected
           `------> Withdrawn
Accepted -> Superseded (link accepted replacement)
Accepted -> Deprecated (record retirement implications)
```

Implementation status is independent:

```text
not-started -> in-progress -> implemented -> verified
```

Acceptance records an authorized decision against concrete content. Verification records
evidence that implementation conforms. An approved initialization does not accept unseen
runtime designs.

Keep stable IDs and preserve rejected/withdrawn reasoning. Substantive changes to accepted
decisions need a successor ADR with reciprocal links; editorial corrections preserve meaning.
Deprecation states what new work must avoid and any migration/retirement implications.

## When an ADR is useful

Create one for consequential component boundaries, public contracts, persistence,
concurrency/recovery, security, portability, dependency strategy, or licensing decisions.
Routine changes inside accepted boundaries need no ADR. Fit the architecture to the
project's size, and defer unknown product decisions explicitly.

## Working sequence

Frame requirement and constraints -> assess architectural impact -> propose alternatives
and recommendation -> review -> obtain decision acceptance -> implement -> verify against
the decision -> update current architecture and implementation status with evidence.

Independent AI review may challenge assumptions when authorized. It cannot fabricate human
acceptance or replace required deterministic checks. If implementation invalidates an accepted
decision, stop the affected work for decision review while continuing independent authorized work.

## Record shape

Use the project's existing ADR format if compatible. Otherwise create an index and this
minimal shape, replacing placeholders in real decision records:

```markdown
# NNNN Decision title

- Status: Draft
- Implementation: not-started
- Date: YYYY-MM-DD
- Author/executor: actual identity
- Reviewer/decision owner: known identity or pending
- Approval evidence: none until established
- Supersedes / Superseded by: none or linked ADR

## Context and constraints
Requirements, affected boundaries, exclusions, and why the decision is needed.

## Alternatives
Feasible options, including keeping the present approach, with tradeoffs.

## Decision or proposal
Recommendation and rationale; distinguish proposed from accepted.

## Consequences
Compatibility, security, operations, dependencies, migration, and limitations.

## Verification and implementation evidence
Acceptance scenarios, linked tasks, candidate/revision, checks, outcomes, and gaps.
```

Architecture overview documents describe the current system; ADRs preserve the reasons
for it. Store confidential approval evidence privately and reference it safely rather than
publishing chat transcripts or private filesystem paths.
