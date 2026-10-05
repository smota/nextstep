# Cross-review report

- **Candidate:** <repository, base, head or "working tree" with its content hash, files in scope>
- **Reviewer:** <harness, model, CLI version>
- **Independence:** <different harness and vendor | same harness, different model (weaker) | not independent: self-review at the user's request>
- **Brief:** <path>
- **Run:** <invocation form, exit status, duration, repository unchanged: yes or no>
- **Rounds:** <n of the limit>

## Findings

| ID | Severity | Location | Requirement | Disposition | Evidence or change |
|---|---|---|---|---|---|
| F1 | <blocking / non-blocking / hypothesis> | `<file:line>` | <ID> | <accepted / refuted / deferred> | <the change made, the refuting evidence, or the scope reason> |

## Confirm round

<Per blocker: confirmed resolved by the reviewer, or disagreement preserved with both positions.>

## Limits

<What this review did not cover. Another model finds some defects and misses others, and nothing here is bound to the candidate beyond the identity above. Deterministic checks and, for high-risk work, human approval remain separate gates.>
