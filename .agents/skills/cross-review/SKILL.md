---
name: cross-review
description: "Run an independent, read-only adversarial review of a change in a different harness or model than the one that wrote it, and report the findings with provenance."
category: software-engineering
disable-model-invocation: true
---

# Cross-review

Get a second opinion that shares neither the author's context nor their blind spots. The implementer never reviews their own work, so the review runs in a different harness and model family. The skill reviews and reports; fixing is a separate step, and a confirm round re-checks the fixes. It stands alone, with no durable state and no issue tracker.

## Inputs

The candidate: by default the current branch's diff against its base, otherwise the uncommitted changes, or a path or plan the user names. Optional: the requirements it must satisfy (acceptance criteria, a plan with slices, non-functional targets), a chosen reviewer, a time budget, and a round limit (default 2).

## Prerequisites

- Read access to the repository, and Git for the candidate's identity.
- A reviewer CLI other than the current harness, installed and signed in (see [reviewers](references/reviewers.md)).
- Permission to send the candidate's code to the reviewer's provider when it differs from the session's.

## Commands

| Command | Reads | Action | Output |
|---|---|---|---|
| `/cross-review [target]` | [reviewers](references/reviewers.md), [brief template](assets/reviewer-brief.template.md), [report template](assets/review-report.template.md) | Run the workflow on the target | The report, ending with the findings and their dispositions |
| `/cross-review confirm` | the same | Run step 6 on the previous round's blockers and the hunks changed since | The updated report |

**Failure:** with no independent reviewer available or consent withheld, report the review as blocked. Self-review happens only at the user's request and is labeled not independent. A reviewer that times out, returns nothing, or exits non-zero counts as no review, and the report gives its exit status.

## Workflow

1. **Fix the candidate.** Record the repository, base and head (commit IDs, or "working tree" with a hash of the diff), and the files in scope. **Complete when:** the candidate's identity is written down.
2. **Choose an independent reviewer.** Independence means a different harness and a different vendor or model family than the author's; a different model in the same harness is weaker and is labeled so. Detect the installed reviewers, confirm each invocation with the CLI's own help, and ask for consent before code goes to another provider. **Complete when:** the reviewer, its invocation, and consent are settled, or the review is reported blocked.
3. **Write the brief.** Fill in the [brief template](assets/reviewer-brief.template.md) with the candidate, each requirement and its ID, and the output format, redacting secrets. Save it outside the repository. **Complete when:** the brief names the candidate, every requirement, and the output format.
4. **Run the reviewer read-only and bounded.** Snapshot `HEAD` and `git status --porcelain`, run the reviewer non-interactively in its read-only mode with a time limit, capture stdout, stderr, and the exit status, then compare the snapshot. A repository that changed is contaminated, and the report says so. **Complete when:** a non-empty response with exit status 0 is captured and the repository is unchanged, or the failure is recorded.
5. **Triage.** Check each blocking finding against the code before acting on it, since the reviewer can be wrong. Give every finding a disposition: accepted with a concrete change, refuted with evidence, or deferred with a scope reason (a required criterion cannot be deferred). **Complete when:** every finding has a disposition.
6. **Confirm.** After the fixes, send the reviewer the resolved blockers and the changed hunks. Stop at the round limit and keep any unresolved disagreement as it stands, without declaring consensus. **Complete when:** the reviewer confirms every blocker resolved, or the disagreement is recorded.
7. **Report.** Fill in the [report template](assets/review-report.template.md): reviewer with CLI version, independence basis, candidate identity, brief path, exit status, rounds, findings with dispositions, and limits. **Complete when:** every field is filled.

Another model finds some defects and misses others. The review supplements deterministic checks, and human approval for high-risk work; it replaces neither.

## Credits

- The reviewer brief and the exchange with a follow-up round adapt the adversarial review protocol of this repository's `empirical-refinement-loop`.
- The independence rule (cross-harness for independence, cross-model for economy) comes from this repository's `project-init` execution model. No dependency on either.
