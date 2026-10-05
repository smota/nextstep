# Independent adversarial review

Use the configured reviewer. Otherwise prefer an available independent internal subagent. External CLI review requires a provider the user selected, permission for the context transmission, and invocation syntax verified locally. Bound time and output, capture exit status, and treat timeout, empty response or execution failure as missing review.

Give the reviewer the scoped objective, proposal, relevant raw source/test evidence, criteria, and constraints. Keep review read-only. Record the actual reviewer/provider and response; a persona performed by the author is self-review, not independent sparring. If no reviewer is available, planning may continue but reviewed implementation is blocked. User-requested self-review is a separately labeled mode.

## Reviewer brief

Act as an adversarial systems reviewer. Challenge the causal hypothesis and whether the proposed experiment could pass while the actual failure remains. Identify concrete mechanisms and evidence, distinguishing observed defects from hypotheses. Inspect concurrency, interrupted operations, rollback, resource ownership and platform behavior only where relevant.
Return blocking objections, nonblocking observations, and proposed reproductions or discriminating measurements. Explain why each blocker threatens a required contract. Keep findings within the scoped objective.

## Exchange and closure

1. Author submits the proposal and evidence.
2. Reviewer returns a critique.
3. Author responds to each objection: accept with a concrete change, refute with evidence, or defer with scope justification.
4. Obtain reviewer confirmation for resolved blocking objections or a materially changed proposal. Unresolved blockers stop implementation; deferral is insufficient for required invariants.

Use the agreed exchange budget. At exhaustion, preserve disagreements and stop rather than declaring consensus. Before acceptance, obtain focused follow-up review when implementation materially differs from the reviewed proposal or new evidence invalidates the resolution. Record the exchange in the round artifact, not only in chat.
